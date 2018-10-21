import { Stage as StageBase, Trigger, Costume } from 'scratch-js'

import nyanBackground from './costumes/nyanBackground.png'
import nyanMusic from './sounds/nyan.mp3'
import meow from './sounds/meow.wav'

export default class Stage extends StageBase {
  constructor(...args) {
    super(...args)

    this.costumes = [
      new Costume('nyanBackground', nyanBackground, { x: 240, y: 180 })
    ]

    this.triggers = [
      new Trigger(Trigger.GREEN_FLAG, this.greenFlag.bind(this)),
      new Trigger(Trigger.KEY_PRESSED, { key: 'space' }, this.keyPressed.bind(this))
    ]
  }

  * greenFlag() {
    this.restartTimer()
    yield* this.playSound(nyanMusic)
  }

  * keyPressed() {
    yield* this.playSound(meow)
  }
}