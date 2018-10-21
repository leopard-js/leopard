import { Sprite, Event, Costume } from 'scratch-js'

import border from './costumes/border.png'
import filled from './costumes/filled.png'

export default class Border extends Sprite {
  constructor(...args) {
    super(...args)

    this.name = 'Border'

    this.costumes = [
      new Costume('border', border, { x: 240, y: 180 }),
      new Costume('filled', filled, { x: 240, y: 180 })
    ]

    this.events = [
      new Event(Event.GREEN_FLAG, this.greenFlag.bind(this))
    ]
  }

  * greenFlag() {
    this.x = 0
    this.y = 0
    this.costume = 'filled'
    this.restartTimer()
    while (!(this.timer > 4.2)) yield
    this.costume = 'border'
  }
}