import Trigger from './Trigger'
import Renderer from './Renderer'
import Input from './Input'
import Vars from './Vars'

export default class Project {
  constructor(stage, sprites = [], globalVars = new Vars()) {
    this.stage = stage
    this.sprites = sprites

    for (let i = 0; i < this.sprites.length; i++) {
      this.sprites[i]._project = this
    }
    this.stage._project = this

    this._vars = globalVars

    this.renderer = new Renderer('#project')
    this.input = new Input(this.renderer.stage, key => {
      this.fireTrigger(Trigger.KEY_PRESSED, { key })
    })
    this.greenFlag = document.querySelector('#greenFlag')

    this.restartTimer()

    this.playingSounds = []
  }

  run() {
    this.runningTriggers = []

    this.step()

    this.stopAllSounds();

    this.greenFlag.addEventListener('click', () => {
      this.fireTrigger(Trigger.GREEN_FLAG)
    })
  }

  step() {
    this.runningTriggers = this.runningTriggers.filter(trigger => {
      return !trigger.step().done
    })

    this.renderer.update(this.stage, this.sprites)

    window.requestAnimationFrame(this.step.bind(this))
  }

  fireTrigger(trigger, options) {
    // Stop existing triggers which match
    this.runningTriggers = this.runningTriggers.filter(
      tr => !tr.matches(trigger, options)
    )

    const spritesAndStage = this.spritesAndStage
    for (let i = 0; i < spritesAndStage.length; i++) {
      const sprite = spritesAndStage[i]
      const triggers = sprite.triggers
        .filter(tr => tr.matches(trigger, options))
        .map(tr => tr.start(this._vars, sprite._vars))
      
      this.runningTriggers = [...this.runningTriggers, ...triggers]
    }

    // Special trigger behaviors
    if (trigger === Trigger.GREEN_FLAG) {
      this.restartTimer()
      this.stopAllSounds()
    }
  }

  get spritesAndStage() {
    return [...this.sprites, this.stage]
  }
  
  playSound(url) {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url)

      const sound = { audio, hasStarted: false }

      const soundEnd = () => {
        this._stopSound(sound)
        resolve()
      }
      audio.addEventListener('ended', soundEnd)
      audio.addEventListener('pause', soundEnd)

      this.playingSounds.push(sound)

      audio.play().then(() => {
        sound.hasStarted = true
      })
    })
  }
  
  _stopSound(sound) {
    if (sound.hasStarted) {
      sound.audio.pause()
    } else {
      // Audio can't be paused because it hasn't started yet
      // (audio.play() is async; can't pause until play starts)
      sound.audio.addEventListener('playing', () => {
        // Stop for real ASAP
        sound.audio.pause()
      })
    }

    // Remove from playingSounds
    const index = this.playingSounds.findIndex(s => s === sound)
    if (index > -1) {
      this.playingSounds.splice(index, 1)
    }
  }
  
  stopAllSounds() {
    console.log('Need to stop:', this.playingSounds)
    const playingSoundsCopy = this.playingSounds.slice()
    for(let i = 0; i < playingSoundsCopy.length; i++) {
      this._stopSound(playingSoundsCopy[i])
    }
  }

  restartTimer() {
    this.timerStart = new Date()
  }
}