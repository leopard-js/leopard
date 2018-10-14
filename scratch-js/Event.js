const GREEN_FLAG = Symbol('GREEN_FLAG')

export default class Event {
  constructor(trigger, script) {
    this.trigger = trigger
    this.script = script
  }

  static get GREEN_FLAG() {
    return GREEN_FLAG
  }
}