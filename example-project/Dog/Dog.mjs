import { Sprite, Trigger, Costume } from '../../scratch-js/index.mjs'

export default class Dog extends Sprite {
  constructor(...args) {
    super(...args)

    this.costumes = [
      new Costume('dog', './Dog/costumes/dog.svg', { x: 81, y: 47 })
    ]

    this.triggers = [
      new Trigger(Trigger.GREEN_FLAG, this.greenFlag.bind(this)),
      new Trigger(Trigger.BROADCAST, { name: 'turn dog' }, this.turn.bind(this))
    ]
  }

  * greenFlag() {
    yield* this.glide(1, (Math.random() - 0.5) * 480, (Math.random() - 0.5) * 360)
  }

  * turn() {
    for(let i = 0; i < 36; i++) {
      this.direction += 10
      this.stage.vars.myGlobalVar = this.random(0, 100)
      yield
    }
  }
}