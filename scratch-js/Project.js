import Event from './Event'
import Renderer from './Renderer'
import Input from './Input'
import Vars from './Vars'

export default class Project {
  constructor(sprites = [], globalVars = new Vars()) {
    this.sprites = sprites
    for (let i = 0; i < this.sprites.length; i++) {
      this.sprites[i]._project = this
    }

    this._vars = globalVars

    this.renderer = new Renderer('#project')
    this.input = new Input(this.renderer.stage)
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

    this.renderer.update(this.sprites)

    window.requestAnimationFrame(this.runFrame.bind(this))
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