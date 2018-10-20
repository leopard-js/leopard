import { Sprite, Costume } from 'scratch-js'

import costume1 from './costumes/costume1.png'

export default class Ground extends Sprite {
  constructor(...args) {
    super(...args)

    this.name = 'Ground'

    this.costumes = [
      new Costume('costume1', costume1, { x: 240, y: 180 })
    ]
  }
}