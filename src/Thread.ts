import { Sprite, Stage } from "./Sprite";
import Trigger from "./Trigger";

export enum ThreadStatus {
  /** This script is currently running. */
  RUNNING,
  /**
   * This script is waiting for a promise, or waiting for other scripts.
   * @todo This requires runtime support.
   */
  // PARKED,
  /** This script is finished running. */
  DONE,
}

export default class Thread {
  public target: Sprite | Stage;
  public trigger: Trigger;
  public status: ThreadStatus;
  private runningScript: Generator;

  public constructor(trigger: Trigger, target: Sprite | Stage) {
    this.runningScript = trigger.startScript(target);
    this.trigger = trigger;
    this.target = target;
    this.status = ThreadStatus.RUNNING;
  }

  public step(): void {
    if (this.runningScript.next().done) {
      this.status = ThreadStatus.DONE;
    }
  }

  public restart(): void {
    this.runningScript = this.trigger.startScript(this.target);
    this.status = ThreadStatus.RUNNING;
  }
}
