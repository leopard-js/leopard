export default class Sprite {
  constructor(initialConditions, vars = {}) {
    const { x, y, direction, costumeNumber, size } = initialConditions

    this.x = x
    this.y = y
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

  get direction() {
    return this._direction
  }

  set direction(dir) {
    this._direction = this.normalizeScratch(dir)
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

  touching(sprName, fast) {
    const sprites = this._project.sprites
    const matching = spr => spr.name === sprName
    const matchingSprites = sprites.filter(matching)

    for (let i = 0; i < matchingSprites.length; i++) {
      const spr = matchingSprites[i]

      const collision = this._project.renderer.checkSpriteCollision(this, spr, fast)
      if (collision) return true
    }

    return false
  }

  get mouse() {
    return this._project.input.mouse
  }

  keyPressed(name) {
    return this._project.input.keyPressed(name)
  }
}