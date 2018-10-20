import { Sprite, Event, Costume } from 'scratch-js'

// Costumes
import costume1 from './costumes/costume1.svg'
import costume2 from './costumes/costume2.svg'

export default class Player extends Sprite {
  constructor(...args) {
    super(...args)

    this.name = 'Player'

    this.costumes = [
      new Costume('costume1', costume1, { x: 47, y: 55 }),
      new Costume('costume2', costume2, { x: 47, y: 55 })
    ]

    this.events = [
      new Event(Event.GREEN_FLAG, this.greenFlag.bind(this)),
    ]
  }

  * greenFlag(globalVars, spr) {
    spr.set('x vel', 0)
    spr.set('y vel', 0)

    while(true) {
      this.platformPhysics(spr, 13, -1, 0.9, 1, 8, 8)
      yield
    }
  }

  platformPhysics(spr, jumpHeight, gravity, friction, speed, wallJumpVM, wallJumpHM) {
    this.y += spr.get('y vel')
    if (this.touching('Ground')) {
      // Vertical movement hit ground
      for(let i = 0; i < Math.abs(spr.get('y vel')); i++) {
        if (this.touching('Ground')) {
          this.y += -1 * Math.sign(spr.get('y vel'))
        }
      }

      // Check for jump
      if (this.keyPressed('up') && spr.get('y vel') <= 0) {
        spr.set('y vel', jumpHeight)
      } else {
        spr.set('y vel', 0)
      }
    } else {
      // In air; fall
      spr.change('y vel', gravity)
    }

    if (this.keyPressed('right')) {
      spr.change('x vel', speed)
    }
    if (this.keyPressed('left')) {
      spr.change('x vel', -speed)
    }

    this.x += spr.get('x vel')
    if (this.touching('Ground')) {
      const oldY = this.y
      for(let i = 0; i < Math.abs(spr.get('x vel')) + 1; i++) {
        if (this.touching('Ground')) {
          this.y += 1
        }
      }
      if (this.touching('Ground')) {
        this.y = oldY
        for(let i = 0; i < Math.ceil(Math.abs(spr.get('x vel'))); i++) {
          if (this.touching('Ground')) {
            this.x -= Math.sign(spr.get('x vel'))
          }
        }
        if (this.keyPressed('up')) {
          if (spr.get('x vel') < 0) {
            spr.set('x vel', 0)
            if (this.keyPressed('left')) {
              spr.set('x vel', wallJumpHM)
              spr.set('y vel', wallJumpVM)
            }
          } else {
            spr.set('x vel', 0)
            if (this.keyPressed('right')) {
              spr.set('x vel', -wallJumpHM)
              spr.set('y vel', wallJumpVM)
            }
          }
        }
      }
    }

    spr.set('x vel', spr.get('x vel') * friction)
  }
}