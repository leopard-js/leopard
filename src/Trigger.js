const GREEN_FLAG = Symbol("GREEN_FLAG");
const KEY_PRESSED = Symbol("KEY_PRESSED");
const BROADCAST = Symbol("BROADCAST");
const CLICKED = Symbol("CLICKED");
const CLONE_START = Symbol("CLONE_START");

export default class Trigger {
  constructor(trigger, options, script) {
    this.trigger = trigger;

    if (typeof script === "undefined") {
      this.options = {};
      this._script = options;
    } else {
      this.options = options;
      this._script = script;
    }

    this.done = false;
    this.stop = () => {};
  }

  matches(trigger, options) {
    if (this.trigger !== trigger) return false;
    for (let option in options) {
      if (this.options[option] !== options[option]) return false;
    }

    return true;
  }

  start(target) {
    this.stop();

    const boundScript = this._script.bind(target);

    this.done = false;
    this._runningScript = boundScript();

    return new Promise(resolve => {
      this.stop = () => {
        this.done = true;
        resolve();
      };
    });
  }

  step() {
    this.done = this._runningScript.next().done;
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
}
