import { Sprite, Trigger, Costume } from 'scratch-js'

import cat from './costumes/cat.svg'

export default class Cat extends Sprite {
  constructor(...args) {
    super(...args)

    this.costumes = [
      new Costume('cat', cat, { x: 47, y: 55 })
    ]

    this.triggers = [
      new Trigger(Trigger.BROADCAST, { name: 'turn cat' }, this.turn.bind(this))
    ]
  }

  * turn() {
    console.log('Turn cat!')
    for(let i = 0; i < 36; i++) {
      yield* this.broadcastAndWait('turn dog')
      this.direction += 10
    }
  }
}