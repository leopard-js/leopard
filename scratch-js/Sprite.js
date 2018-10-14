export default class Sprite {
  constructor(initialConditions, vars = {}) {
    const { x, y, direction, costumeNumber, size } = initialConditions

    this._x = x
    this._y = y
    this._direction = direction
    this.costumeNumber = costumeNumber
    this.size = size

    this.events = []
    this.costumes = []

    this._vars = vars
  }

  set costume(costume) {
    if (typeof costume === 'number') {
      this.costumeNumber = (costume - 1) % this.costumes.length + 1
    }
    if (typeof costume === 'string') {
      const index = this.costumes.findIndex(c => c.name === costume)
      if (index > -1) this.costumeNumber = index
    }
  }

  get costume() {
    return this.costumes[this.costumeNumber - 1]
  }

  set x(x) {
    this._x = Math.round(x)
  }

  get x() {
    return this._x
  }

  set y(y) {
    this._y = Math.round(y)
  }

  get y() {
    return this._y
  }

  get direction() {
    return this._direction
  }

  set direction(dir) {
    this._direction = this.normalizeDeg(dir)
  }

  degToScratch(deg) {
    return -deg + 90
  }

  scratchToDeg(scratchDir) {
    return -scratchDir + 90
  }

  scratchToRad(scratchDir) {
    return this.scratchToDeg(scratchDir) * Math.PI / 180
  }

  normalizeDeg(deg) {
    while(deg <= -180) deg += 360
    while(deg > 180) deg -= 360

    return deg
  }

  move(dist) {
    const moveDir = this.scratchToRad(this.direction)
    this.x += dist * Math.cos(moveDir)
    this.y += dist * Math.sin(moveDir)
  }

  random(a, b) {
    // TODO: Replicate rounding of Scratch
    return Math.floor(Math.random() * (b - a)) + a
  }

  * wait(secs) {
    let endTime = new Date()
    endTime.setMilliseconds(endTime.getMilliseconds() + secs * 1000)
    while (new Date() < endTime) {
      yield
    }
  }
}