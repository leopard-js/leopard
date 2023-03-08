import type { Sprite, Stage } from "./Sprite.js";

const GREEN_FLAG = Symbol("GREEN_FLAG");
const KEY_PRESSED = Symbol("KEY_PRESSED");
const BROADCAST = Symbol("BROADCAST");
const CLICKED = Symbol("CLICKED");
const CLONE_START = Symbol("CLONE_START");
const LOUDNESS_GREATER_THAN = Symbol("LOUDNESS_GREATER_THAN");
const TIMER_GREATER_THAN = Symbol("TIMER_GREATER_THAN");
const BACKDROP_CHANGED = Symbol("BACKDROP_CHANGED");

type TriggerOption =
  | number
  | string
  | boolean
  | ((target: Sprite | Stage) => number | string | boolean);

type TriggerOptions = Partial<Record<string, TriggerOption>>;

export default class Trigger {
  trigger: symbol;
  options: TriggerOptions;
  _script: GeneratorFunction;
  _runningScript: Generator | undefined;
  done: boolean;
  stop: () => void;

  constructor(
    trigger: Trigger["trigger"],
    options: Trigger["options"] | Trigger["_script"],
    script?: Trigger["_script"]
  ) {
    this.trigger = trigger;

    if (typeof script === "undefined") {
      this.options = {};
      this._script = options as Trigger["_script"];
    } else {
      this.options = options as Trigger["options"];
      this._script = script;
    }

    this.done = false;
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this.stop = () => {};
  }

  get isEdgeActivated() {
    return (
      this.trigger === TIMER_GREATER_THAN ||
      this.trigger === LOUDNESS_GREATER_THAN
    );
  }

  // Evaluate the given trigger option, whether it's a value or a function that
  // returns a value given a target
  option(option: string, target: Sprite | Stage) {
    const triggerOption = this.options[option];
    // If the given option is a function, evaluate that function, passing in
    // the target that we're evaluating the trigger for
    if (typeof triggerOption === "function") {
      return triggerOption(target);
    }
    return triggerOption;
  }

  matches(
    trigger: Trigger["trigger"],
    options: Trigger["options"] | undefined,
    target: Sprite | Stage
  ) {
    if (this.trigger !== trigger) return false;
    for (const option in options) {
      if (this.option(option, target) !== options[option]) return false;
    }

    return true;
  }

  start(target: Sprite | Stage) {
    this.stop();

    const boundScript = this._script.bind(target);

    this.done = false;
    this._runningScript = boundScript();

    return new Promise<void>((resolve) => {
      this.stop = () => {
        this.done = true;
        resolve();
      };
    });
  }

  step() {
    if (!this._runningScript) return;
    this.done = !!this._runningScript.next().done;
    if (this.done) this.stop();
  }

  static get GREEN_FLAG() {
    return GREEN_FLAG;
  }
  static get KEY_PRESSED() {
    return KEY_PRESSED;
  }
  static get BROADCAST() {
    return BROADCAST;
  }
  static get CLICKED() {
    return CLICKED;
  }
  static get CLONE_START() {
    return CLONE_START;
  }
  static get LOUDNESS_GREATER_THAN() {
    return LOUDNESS_GREATER_THAN;
  }
  static get TIMER_GREATER_THAN() {
    return TIMER_GREATER_THAN;
  }
  static get BACKDROP_CHANGED() {
    return BACKDROP_CHANGED;
  }
}

export type { TriggerOption, TriggerOptions };
