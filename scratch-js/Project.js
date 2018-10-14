import Event from './Event'

export default class Project {
  constructor(sprites = [], globalVars = {}) {
    this.sprites = sprites
    this._vars = globalVars

    this.greenFlag = document.querySelector('#greenFlag')
  }

  run() {
    this.runningScripts = []

    this.runFrame()

    this.greenFlag.addEventListener('click', () => {
      this._fireEvent(Event.GREEN_FLAG)
    })
  }

  runFrame() {
    this.runningScripts = this.runningScripts.filter(script => {
      return !script.next().done
    })

    this._updateScreen()

    window.requestAnimationFrame(this.runFrame.bind(this))
  }

  _updateScreen() {
    const output = document.querySelector('#project')
    output.innerHTML = ''
    this.sprites.forEach(sprite => {
      output.innerHTML += `<h2>${sprite.constructor.name}</h2>`
      output.innerHTML += `<div style="width: 100px; transform: rotate(${sprite.direction - 90}deg) translate(${sprite.x}px, ${sprite.y}px);">${sprite.costume.image}</div>`
      output.innerHTML += `<div>(${sprite.x}, ${sprite.y}) @ ${sprite.direction}&deg;</div>`
    })
  }

  _fireEvent(event) {
    for (let i = 0; i < this.sprites.length; i++) {
      // TODO: Stop + restart scripts which are already running
      const sprite = this.sprites[i]
      const events = sprite.events.filter(ev => ev.trigger === event)
      const scripts = events.map(ev => ev.script(this._vars, sprite._vars))
      this.runningScripts = [...this.runningScripts, ...scripts]
    }
  }
}