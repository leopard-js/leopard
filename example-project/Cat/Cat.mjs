import { Sprite, Trigger, Costume } from '../../scratch-js/index.mjs'

export default class Cat extends Sprite {
  constructor(...args) {
    super(...args)

    this.name = 'Cat'

    this.costumes = [
      new Costume('cat', './Cat/costumes/cat.svg', { x: 47, y: 55 })
    ]

    this.triggers = [
      new Trigger(Trigger.GREEN_FLAG, this.greenFlag.bind(this)),
      new Trigger(Trigger.BROADCAST, { name: 'turn cat' }, this.turn.bind(this))
    ]
  }

  * greenFlag() {
    while (true) {
      this.goto(this.mouse.x, this.mouse.y)
      if (this.touching(this.sprites.dog)) {
        console.log('Touching!')
      }
      yield
    }
  }

  * turn() {
    for(let i = 0; i < 36; i++) {
      yield* this.broadcastAndWait('turn dog')
      this.direction += this.vars.speed
      this.vars.speed += 1
    }
  }
}