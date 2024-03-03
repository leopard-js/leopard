import type { Sprite, Stage } from "./Sprite";

type TriggerOption =
  | number
  | string
  | boolean
  | ((target: Sprite | Stage) => number | string | boolean);

type TriggerOptions = Partial<Record<string, TriggerOption>>;

export default class Trigger {
  public trigger;
  private options: TriggerOptions;
  private _script: GeneratorFunction;
  private _runningScript: Generator | undefined;
  public done: boolean;
  private stop: () => void;

  public constructor(
    trigger: symbol,
    options: TriggerOptions,
    script?: GeneratorFunction
  );
  public constructor(trigger: symbol, script: GeneratorFunction);
  public constructor(
    trigger: symbol,
    optionsOrScript: TriggerOptions | GeneratorFunction,
    script?: GeneratorFunction
  ) {
    this.trigger = trigger;

    if (typeof script === "undefined") {
      this.options = {};
      this._script = optionsOrScript as GeneratorFunction;
    } else {
      this.options = optionsOrScript as TriggerOptions;
      this._script = script;
    }

    this.done = false;
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this.stop = () => {};
  }

  public get isEdgeActivated(): boolean {
    return (
      this.trigger === Trigger.TIMER_GREATER_THAN ||
      this.trigger === Trigger.LOUDNESS_GREATER_THAN
    );
  }

  // Evaluate the given trigger option, whether it's a value or a function that
  // returns a value given a target
  public option(
    option: string,
    target: Sprite | Stage
  ): number | string | boolean | undefined {
    const triggerOption = this.options[option];
    // If the given option is a function, evaluate that function, passing in
    // the target that we're evaluating the trigger for
    if (typeof triggerOption === "function") {
      return triggerOption(target);
    }
    return triggerOption;
  }

  public matches(
    trigger: Trigger["trigger"],
    options: Trigger["options"] | undefined,
    target: Sprite | Stage
  ): boolean {
    if (this.trigger !== trigger) return false;
    for (const option in options) {
      if (this.option(option, target) !== options[option]) return false;
    }

    return true;
  }

  public start(target: Sprite | Stage): Promise<void> {
    this.stop();

    this.done = false;
    this._runningScript = this._script.call(target);

    return new Promise<void>((resolve) => {
      this.stop = (): void => {
        this.done = true;
        resolve();
      };
    });
  }

  public step(): void {
    if (!this._runningScript) return;
    this.done = !!this._runningScript.next().done;
    if (this.done) this.stop();
  }

  public clone(): Trigger {
    return new Trigger(this.trigger, this.options, this._script);
  }

  public static readonly GREEN_FLAG = Symbol("GREEN_FLAG");
  public static readonly KEY_PRESSED = Symbol("KEY_PRESSED");
  public static readonly BROADCAST = Symbol("BROADCAST");
  public static readonly CLICKED = Symbol("CLICKED");
  public static readonly CLONE_START = Symbol("CLONE_START");
  public static readonly LOUDNESS_GREATER_THAN = Symbol(
    "LOUDNESS_GREATER_THAN"
  );
  public static readonly TIMER_GREATER_THAN = Symbol("TIMER_GREATER_THAN");
  public static readonly BACKDROP_CHANGED = Symbol("BACKDROP_CHANGED");
}

export type { TriggerOption, TriggerOptions };
