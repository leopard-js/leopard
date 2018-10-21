const GREEN_FLAG = Symbol('GREEN_FLAG')
const KEY_PRESSED = Symbol('KEY_PRESSED')

export default class Trigger {
  constructor(trigger, options, script) {
    this.trigger = trigger
    if (typeof script === 'undefined') {
      this.options = {}
      this._script = options
    } else {
      this.options = options
      this._script = script
    }
  }

  static get GREEN_FLAG() {
    return GREEN_FLAG
  }

  static get KEY_PRESSED() {
    return KEY_PRESSED
  }

  matches(trigger, options) {
    if (this.trigger !== trigger) return false
    for (let option in options) {
      if (this.options[option] !== options[option]) return false
    }
    return true
  }

  start(...args) {
    this._scriptRunning = this._script(...args)
    return this
  }

  step() {
    return this._scriptRunning.next()
  }
}