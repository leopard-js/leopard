import { Stage as StageBase, Event, Costume } from 'scratch-js'

import nyanBackground from './costumes/nyanBackground.png'
import nyanMusic from './sounds/nyan.mp3'
import meow from './sounds/meow.wav'

export default class Stage extends StageBase {
  constructor(...args) {
    super(...args)

    this.costumes = [
      new Costume('nyanBackground', nyanBackground, { x: 240, y: 180 })
    ]

    this.events = [
      new Event(Event.GREEN_FLAG, this.greenFlag.bind(this))
    ]
  }

  * greenFlag() {
    this.restartTimer()
    yield* this.playSound(meow)
    yield* this.playSound(nyanMusic)
  }
}