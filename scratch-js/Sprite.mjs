import Trigger from './Trigger.mjs'

class SpriteBase {
  constructor(initialConditions, vars = {}) {
    this._project = null
    
    const { costumeNumber } = initialConditions
    this.costumeNumber = costumeNumber

    this.triggers = []
    this.costumes = []

    this._vars = vars
  }

  get vars() {
    return this._vars
  }

  set costume(costume) {
    if (typeof costume === 'number') {
      this.costumeNumber = (costume - 1) % this.costumes.length + 1
    }
    if (typeof costume === 'string') {
      const index = this.costumes.findIndex(c => c.name === costume)
      if (index > -1) this.costumeNumber = index + 1
    }
  }

  get costume() {
    return this.costumes[this.costumeNumber - 1]
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
    return ((deg - 180) % 360) + 180
  }

  normalizeScratch(scratchDir) {
    const deg = this.scratchToDeg(scratchDir)
    const normalized = this.normalizeDeg(deg)
    return this.degToScratch(normalized)
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

  get mouse() {
    return this._project.input.mouse
  }

  keyPressed(name) {
    return this._project.input.keyPressed(name)
  }

  get timer() {
    const ms = new Date() - this._project.timerStart
    return ms / 1000
  }

  restartTimer() {
    this._project.restartTimer()
  }

  * playSound(url) {
    let playing = true
    this._project.playSound(url).then(() => {
      playing = false
    })

    while (playing) yield
  }

  stopAllSounds() {
    this._project.stopAllSounds()
  }

  broadcast(name) {
    return this._project.fireTrigger(Trigger.BROADCAST, { name })
  }

  * broadcastAndWait(name) {
    let running = true
    this.broadcast(name).then(() => {
      running = false
    })

    while(running) { yield }
  }
}

export class Sprite extends SpriteBase {
  constructor(initialConditions, ...args) {
    super(initialConditions, ...args)

    const { x, y, direction, costumeNumber, size, visible, penDown, penSize, penColor } = initialConditions

    this._x = x
    this._y = y
    this._direction = direction
    this.costumeNumber = costumeNumber
    this.size = size
    this.visible = visible

    this._penDown = penDown || false
    this.penSize = penSize || 1
    this.penColor = penColor || 'blue'
  }

  get stage() {
    return this._project.stage
  }

  get direction() {
    return this._direction
  }

  set direction(dir) {
    this._direction = this.normalizeScratch(dir)
  }

  goto(x, y) {
    if (x === this.x && y === this.y) return
    
    if (this.penDown) {
      this._project.renderer.penLine(
        { x: this._x, y: this._y },
        { x, y },
        this.penColor,
        this.penSize
      )
    }

    this._x = x
    this._y = y
  }

  get x() {
    return this._x
  }

  set x(x) {
    this.goto(x, this._y)
  }

  get y() {
    return this._y
  }

  set y(y) {
    this.goto(this._x, y)
  }

  move(dist) {
    const moveDir = this.scratchToRad(this.direction)

    this.goto(
      this._x + dist * Math.cos(moveDir),
      this._y + dist * Math.sin(moveDir)
    )
  }

  * glide(seconds, x, y) {
    const interpolate = (a, b, t) => a + (b - a) * t

    const startTime = new Date()
    const startX = this._x
    const startY = this._y

    let t
    do {
      t = (new Date() - startTime) / (seconds * 1000)
      this.goto(
        interpolate(startX, x, t),
        interpolate(startY, y, t)
      )
      yield
    } while (t < 1)
  }

  get penDown() {
    return this._penDown
  }

  set penDown(penDown) {
    if (penDown) {
      this._project.renderer.penLine(
        { x: this.x, y: this.y },
        { x: this.x, y: this.y },
        this.penColor,
        this.penSize
      )
    }
    this._penDown = penDown
  }

  stamp() {
    this._project.renderer.stamp(this)
  }

  clearPen() {
    this._project.renderer.clearPen()
  }

  touching(sprName, fast) {
    if (!this.visible) return false

    const sprites = this._project.sprites
    const matching = spr => spr.name === sprName
    const matchingSprites = sprites.filter(matching)

    for (let i = 0; i < matchingSprites.length; i++) {
      const spr = matchingSprites[i]

      if (!spr.visible) continue

      const collision = this._project.renderer.checkSpriteCollision(this, spr, fast)
      if (collision) return true
    }

    return false
  }
}

export class Stage extends SpriteBase {
  constructor(...args) {
    super(...args)
  }
}