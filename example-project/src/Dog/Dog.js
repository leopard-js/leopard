import { Sprite, Trigger, Costume } from 'scratch-js'

import dog from './costumes/dog.svg'

export default class Dog extends Sprite {
  constructor(...args) {
    super(...args)

    this.costumes = [
      new Costume('dog', dog, { x: 81, y: 47 })
    ]

    this.triggers = [
      new Trigger(Trigger.BROADCAST, { name: 'turn dog' }, this.turn.bind(this))
    ]
  }

  * turn() {
    for(let i = 0; i < 36; i++) {
      this.direction += 10
      yield
    }
  }
}