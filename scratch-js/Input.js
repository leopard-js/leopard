export default class Input {
  constructor(stage) {
    this._stage = stage

    // Allow setting focus to canvas
    this._stage.tabIndex = '1'

    this.mouse = { x: 0, y: 0 }
    this._stage.addEventListener('mousemove', this._updateMouse.bind(this))

    this._stage.addEventListener('keyup', this._keyup.bind(this))
    this._stage.addEventListener('keydown', this._keydown.bind(this))

    this.keys = []
  }

  _updateMouse(e) {
    const rect = this._stage.getBoundingClientRect()
    const realCoords = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }

    this.mouse = {
      x: realCoords.x - this._stage.width / 2,
      y: -realCoords.y + this._stage.height / 2
    }
  }

  _keyup(e) {
    const key = this._getKeyName(e)
    this.keys = this.keys.filter(k => k !== key)
  }

  _keydown(e) {
    const key = this._getKeyName(e)
    if (this.keys.indexOf(key) === -1) {
      this.keys.push(key)
    }
  }

  _getKeyName(e) {
    if (e.key === 'ArrowUp') return 'up'
    if (e.key === 'ArrowDown') return 'down'
    if (e.key === 'ArrowLeft') return 'left'
    if (e.key === 'ArrowRight') return 'right'
    if (e.key === ' ') return 'space'
    if(e.code.substring(0, 5) === 'Digit') return e.code[5]

    return e.key.toLowerCase()
  }

  keyPressed(name) {
    if (name === 'any') return this.keys.length > 0
    return this.keys.indexOf(name) > -1
  }
}