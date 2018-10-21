import { Sprite, Trigger, Costume } from 'scratch-js'

import dot from './costumes/dot.png'
import cat from './costumes/cat.svg'
import filled from './costumes/filled.png'

export default class Drawer extends Sprite {
  constructor(...args) {
    super(...args)

    this.costumes = [
      new Costume('dot', dot, { x: 1, y: 1 }),
      new Costume('cat', cat, { x: 67, y: 48 }),
      new Costume('filled', filled, { x: 240, y: 180 })
    ]

    this.triggers = [
      new Trigger(Trigger.GREEN_FLAG, this.greenFlag.bind(this))
    ]
  }

  * greenFlag(global, spr) {
    this.resetData(global, spr)

    while(true) {
      this.render(spr, 6)
      this.updateStars(global, spr)
      spr.set('i', this.timer * 250)
      global.change('frame count', 1)
      yield
    }
  }

  resetData(global, spr) {
    global.set('frame count', 0)
    spr.set('star x', [])
    spr.set('star y', [])
    spr.set('star type', [])
    spr.set('star frame', [])
  }

  render(spr, speed) {
    this.clearPen()
    this.costume = 'dot'
    this.size = 100

    this.renderStars(spr)
    this.fullRainbow(spr, 4, speed)
    this.renderCat(10, Math.cos(this.scratchToRad((spr.get('i') * speed / 2))) * 5 - 4)
  }

  fullRainbow(spr, scale, speed) {
    this.penSize = scale * 2

    this.penColor = 'rgb(255, 0, 0)'
    this.rainbow(spr, 5 * scale, spr.get('i') * speed)
    
    this.penColor = 'rgb(255, 127, 0)'
    this.rainbow(spr, 3 * scale, spr.get('i') * speed)

    this.penColor = 'rgb(255, 255, 0)'
    this.rainbow(spr, 1 * scale, spr.get('i') * speed)

    this.penColor = 'rgb(0, 255, 0)'
    this.rainbow(spr, -1 * scale, spr.get('i') * speed)

    this.penColor = 'rgb(0, 127, 255)'
    this.rainbow(spr, -3 * scale, spr.get('i') * speed)

    this.penColor = 'rgb(153, 6, 255)'
    this.rainbow(spr, -5 * scale, spr.get('i') * speed)
  }

  rainbow(spr, y, i) {
    this.penDown = false
    spr.set('n', -240)
    for(let j = 0; j < 120; j++) {
      this.x = spr.get('n')
      this.y = Math.cos(this.scratchToRad(spr.get('n') * 12 + i)) * 2 + y
      this.penDown = true
      spr.change('n', 2)
    }
  }

  renderCat(x, y) {
    this.costume = 'cat'
    this.size = 150
    this.x = x
    this.y = y
    this.stamp()
  }

  updateStars(global, spr) {
    let n = 0
    while (n < spr.get('star x').length) {
      spr.get('star x')[n] -= 8
      spr.get('star frame')[n] = spr.get('star frame')[n] % 6 + 1
      if (spr.get('star x')[n] < -240) {
        spr.get('star x').splice(n, 1)
        spr.get('star y').splice(n, 1)
        spr.get('star type').splice(n, 1)
        spr.get('star frame').splice(n, 1)
      } else {
        n++
      }
    }
    if (global.get('frame count') % 4 === 0) {
      spr.get('star x').push(240)
      spr.get('star y').push(this.random(-180, 180))
      spr.get('star type').push(this.random(1, 2))
      spr.get('star frame').push(this.random(1, 5))
    }
  }

  renderStars(spr) {
    for(let n = 0; n < spr.get('star x').length; n++) {
      this.star(
        spr.get('star x')[n],
        spr.get('star y')[n],
        spr.get('star type')[n],
        spr.get('star frame')[n]
      )
    }
  }

  star(x, y, type, frame) {
    if (type === 1) {
      this.starFrame(frame, x, y)
    } else {
      this.starFrame(6 - frame, x, y)
    }
  }

  starFrame(frame, x, y) {
    this.penSize = 2
    this.penColor = '#fff'
    this.penDown = false

    if (frame === 1) {
      this.x = x
      this.y = y
      this.penDown = true
      this.penDown = false
    }
    if (frame === 2) {
      this.x = x - 2
      this.y = y
      this.penDown = true
      this.penDown = false

      this.x = x + 2
      this.y = y
      this.penDown = true
      this.penDown = false

      this.x = x
      this.y = y - 2
      this.penDown = true
      this.penDown = false

      this.x = x
      this.y = y + 2
      this.penDown = true
      this.penDown = false
    }
    if (frame === 3) {
      this.x = x - 2
      this.y = y
      this.penDown = true
      this.x = x - 4
      this.penDown = false
      this.x = x + 2
      this.penDown = true
      this.x = x + 4
      this.penDown = false
      this.x = x
      this.y = y - 2
      this.penDown = true
      this.y = y - 4
      this.penDown = false
      this.y = y + 2
      this.penDown = true
      this.y = y + 4
      this.penDown = false
    }
    if (frame > 3) {
      this.x = x - 6
      this.y = y
      this.penDown = true
      this.penDown = false

      this.x = x + 6
      this.penDown = true
      this.penDown = false

      this.x = x
      this.y = y - 6
      this.penDown = true
      this.penDown = false

      this.y = y + 6
      this.penDown = true
      this.penDown = false
    }
    if (frame === 5) {
      this.x = x - 4
      this.y = y + 4
      this.penDown = true
      this.penDown = false

      this.x = x - 4
      this.y = y - 4
      this.penDown = true
      this.penDown = false

      this.x = x + 4
      this.y = y + 4
      this.penDown = true
      this.penDown = false

      this.x = x + 4
      this.y = y - 4
      this.penDown = true
      this.penDown = false
    }
  }
}