import { Sprite, Trigger, Costume } from '../../scratch-js/index.mjs'

export default class Cat extends Sprite {
  constructor(...args) {
    super(...args)

    this.costumes = [
      new Costume('cat', './Cat/costumes/cat.svg', { x: 47, y: 55 })
    ]

    this.triggers = [
      new Trigger(Trigger.KEY_PRESSED, { key: 'right' }, this.keyRight.bind(this)),
      new Trigger(Trigger.KEY_PRESSED, { key: 'left' }, this.keyLeft.bind(this)),
      new Trigger(Trigger.KEY_PRESSED, { key: 'up' }, this.keyUp.bind(this)),
      new Trigger(Trigger.KEY_PRESSED, { key: 'down' }, this.keyDown.bind(this)),
      new Trigger(Trigger.KEY_PRESSED, { key: 'space' }, this.keySpace.bind(this)),
      new Trigger(Trigger.KEY_PRESSED, { key: 'w' }, this.keyW.bind(this)),
      new Trigger(Trigger.KEY_PRESSED, { key: 's' }, this.keyS.bind(this)),
      new Trigger(Trigger.BROADCAST, { name: 'turn cat' }, this.turn.bind(this))
    ]
  }

  * keyRight() {
    this.x += 10
  }

  * keyLeft() {
    this.x -= 10
  }

  * keyUp() {
    this.y += 10
  }

  * keyDown() {
    this.y -= 10
  }

  * keySpace() {
    this.goto(0, 0)
  }

  * keyW() {
    this.move(10)
  }

  * keyS() {
    this.move(-10)
  }

  * turn() {
    for(let i = 0; i < 36; i++) {
      yield* this.broadcastAndWait('turn dog')
      this.direction += 10
    }
  }
}