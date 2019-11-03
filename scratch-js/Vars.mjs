const WATCHERTYPE_NORMAL = Symbol('NORMAL')

class VarWatcher {
  constructor(visible = false, type = this.NORMAL, x = 0, y = 0) {
    this.visible = visible
    this.type = type
    this.x = x
    this.y = y
  }

  static get NORMAL() {
    return WATCHERTYPE_NORMAL
  }
}

class Var {
  constructor(value = 0, watcher = new VarWatcher()) {
    this.value = value
    this.watcher = watcher
  }
}

export default class Vars {
  constructor(varValues = {}) {
    this.vars = {}

    for (let variable in varValues) {
      this.vars[variable] = new Var(varValues[variable])
    }
  }

  get(varName) {
    return this.vars[varName].value
  }

  set(varName, value) {
    if (this.vars.hasOwnProperty(varName)) {
      this.vars[varName].value = value
    } else {
      this.vars[varName] = new Var(value)
    }
  }

  change(varName, value) {
    if (this.vars.hasOwnProperty(varName)) {
      this.vars[varName].value += value
    } else {
      this.vars[varName] = new Var(value)
    }
  }

  show(varName) {
    if (this.vars.hasOwnProperty(varName)) {
      this.vars[varName].watcher.visible = true
    }
  }

  hide(varName) {
    if (this.vars.hasOwnProperty(varName)) {
      this.vars[varName].watcher.visible = false
    }
  }
}