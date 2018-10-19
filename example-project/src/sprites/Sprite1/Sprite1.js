import { Sprite, Event, Costume } from 'scratch-js'

// Costumes
import costume1 from './costumes/costume1.svg'
import costume2 from './costumes/costume2.svg'

export default class Sprite1 extends Sprite {
  constructor(...args) {
    super(...args)

    this.costumes = [
      new Costume('costume1', costume1, { x: 47, y: 55 }),
      new Costume('costume2', costume2, { x: 47, y: 55 })
    ]

    this.events = [
      new Event(Event.GREEN_FLAG, this.greenFlag.bind(this)),
      new Event(Event.GREEN_FLAG, this.greenFlag2.bind(this))
    ]
  }

  * greenFlag() {
    this.x = 0
    this.y = 0
    this.direction = 90
    
    while(true) {
      this.direction += 3
      this.move(3)
      yield
    }
  }

  * greenFlag2() {
    while (true) {
      yield* this.walk(0.2)
      yield
    }
  }

  * walk(speed) {
    this.costume = this.costumeNumber + 1
    this.size *= 1.2
    yield* this.wait(speed)
  }
}