import { Yielding } from "./lib/yielding";
import { Sprite, Stage } from "./Sprite";
import Trigger from "./Trigger";

export enum ThreadStatus {
  /** This script is currently running. */
  RUNNING,
  /** This script is waiting for a promise, or waiting for other scripts. */
  PARKED,
  /** This script is finished running. */
  DONE,
}

const YIELD_TO = Symbol("YIELD_TO");
const PROMISE_WAIT = Symbol("PROMISE_WAIT");

/**
 * Yielding these special values from a thread will pause the thread's execution
 * until some conditions are met.
 */
export type ThreadEffect =
  | {
      type: typeof YIELD_TO;
      thread: Thread;
    }
  | {
      type: typeof PROMISE_WAIT;
      promise: Promise<unknown>;
    };

const isThreadEffect = (value: unknown): value is ThreadEffect =>
  typeof value === "object" &&
  value !== null &&
  "type" in value &&
  typeof value.type === "symbol";

enum CompletionKind {
  FULFILLED,
  REJECTED,
}

export default class Thread {
  /** The sprite or stage that this thread's script is part of. */
  public target: Sprite | Stage;
  /** The trigger that started this thread. Used to restart it. */
  public trigger: Trigger;
  /** This thread's status. Exposed as a getter and setStatus function. */
  private _status: ThreadStatus;
  /** The generator function that's currently executing. */
  private runningScript: Generator;
  /**
   * If this thread was waiting for a promise, the resolved value of that
   * promise. It will be passed into the generator function (or thrown, if it's
   * an error).
   */
  private resolvedValue: { type: CompletionKind; value: unknown } | null;
  /**
   * Callback functions to execute once this thread exits the "parked" status.
   */
  private onUnpark: (() => void)[];
  /**
   * Incremented when this thread is restarted; used when resuming from
   * promises. If the generation counter is different from what it was when the
   * promise started, we don't do anything with the resolved value.
   */
  private generation: number;

  public constructor(trigger: Trigger, target: Sprite | Stage) {
    this.runningScript = trigger.startScript(target);
    this.trigger = trigger;
    this.target = target;
    this._status = ThreadStatus.RUNNING;
    this.resolvedValue = null;
    this.generation = 0;
    this.onUnpark = [];
  }

  private unpark(): void {
    for (const callback of this.onUnpark) {
      callback();
    }
    this.onUnpark.length = 0;
  }

  public get status(): ThreadStatus {
    return this._status;
  }

  /**
   * Set the thread's status. This is a function and not a setter to make it
   * clearer that it has side effects (potentially calling "on unpark"
   * callbacks).
   * @param newStatus The status to set.
   */
  public setStatus(newStatus: ThreadStatus): void {
    if (
      this._status === ThreadStatus.PARKED &&
      newStatus !== ThreadStatus.PARKED
    ) {
      this.unpark();
    }
    this._status = newStatus;
  }

  /**
   * Step this thread once. Does nothing if the status is not RUNNING (e.g. the
   * thread is waiting for a promise to resolve).
   */
  public step(): void {
    if (this._status !== ThreadStatus.RUNNING) return;

    let next;

    // Pass a promise's resolved value into the generator depending on whether
    // it fulfilled or rejected.
    if (this.resolvedValue !== null) {
      if (this.resolvedValue.type === CompletionKind.REJECTED) {
        // If the promise rejected, throw the error inside the generator.
        next = this.runningScript.throw(this.resolvedValue.value);
      } else {
        next = this.runningScript.next(this.resolvedValue.value);
      }
      this.resolvedValue = null;
    } else {
      next = this.runningScript.next();
    }

    if (next.done) {
      this.setStatus(ThreadStatus.DONE);
    } else if (isThreadEffect(next.value)) {
      switch (next.value.type) {
        case PROMISE_WAIT: {
          // Wait for the promise to resolve then pass its value back into the generator.
          this.setStatus(ThreadStatus.PARKED);
          const generation = this.generation;
          next.value.promise.then(
            (value) => {
              // If the thread has been restarted since the promise was created,
              // do nothing.
              if (this.generation !== generation) return;
              this.resolvedValue = { type: CompletionKind.FULFILLED, value };
              this.setStatus(ThreadStatus.RUNNING);
            },
            (err) => {
              if (this.generation !== generation) return;
              this.resolvedValue = {
                type: CompletionKind.REJECTED,
                value: err,
              };
              this.setStatus(ThreadStatus.RUNNING);
            }
          );
          break;
        }
        case YIELD_TO: {
          // If the given thread is parked, park ourselves and wait for it to unpark.
          if (next.value.thread.status === ThreadStatus.PARKED) {
            this.setStatus(ThreadStatus.PARKED);
            next.value.thread.onUnpark.push(() => {
              this.setStatus(ThreadStatus.RUNNING);
              this.unpark();
            });
          }
        }
      }
    }
    this.resolvedValue = null;
  }

  /**
   * Await a promise and pass the result back into the generator.
   * @param promise The promise to await.
   * @returns Generator which yields the resolved value.
   */
  public static *await<T>(promise: Promise<T>): Generator<ThreadEffect, T, T> {
    return yield { type: PROMISE_WAIT, promise };
  }

  /**
   * If run inside another thread, waits for *this* thread to make progress.
   */
  public *yieldTo(): Yielding<void> {
    yield { type: YIELD_TO, thread: this };
  }

  /**
   * If run inside another thread, waits until *this* thread is done running.
   */
  public *waitUntilDone(): Yielding<void> {
    while (this.status !== ThreadStatus.DONE) {
      yield* this.yieldTo();
    }
  }

  /**
   * Wait for all the given threads to finish executing.
   * @param threads The threads to wait for.
   */
  public static *waitForThreads(threads: Thread[]): Yielding<void> {
    for (const thread of threads) {
      if (thread.status !== ThreadStatus.DONE) {
        yield* thread.waitUntilDone();
      }
    }
  }

  /**
   * Restart this thread in-place.
   */
  public restart(): void {
    this.generation++;
    this.runningScript = this.trigger.startScript(this.target);
    this.unpark();
  }
}
