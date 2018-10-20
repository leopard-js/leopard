export default class Renderer {
  constructor(container) {
    if (typeof container === 'string') {
      container = document.querySelector(container)
    }
    this.container = container

    this.stage = this.createStage()
    this.stage.style.border = '1px solid black'

    this.ctx = this.stage.getContext('2d')

    this.container.append(this.stage)
  }

  update(sprites) {
    this.ctx.clearRect(0, 0, this.stage.width, this.stage.height)

    sprites.forEach(spr => {
      this.renderSprite(spr, this.ctx)
    })

    this.ctx.font = '12px monospace'
    this.ctx.fillStyle = '#aaa'
  }

  createStage() {
    const stage = document.createElement('canvas')
    stage.width = 480
    stage.height = 360

    return stage
  }

  renderSprite(spr, ctx) {
    ctx.save()

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.translate(this.stage.width / 2, this.stage.height / 2)
    ctx.translate(spr.x, -spr.y)
    ctx.rotate(-spr.scratchToRad(spr.direction))
    ctx.scale(spr.size / 100, spr.size / 100)
    ctx.translate(-spr.costume.center.x, -spr.costume.center.y)
    
    ctx.drawImage(spr.costume.img, 0, 0)

    ctx.restore()
  }

  getBoundingBox(sprite) {
    const origin = {
      x: sprite.x + 240,
      y: -sprite.y + 180
    }

    const s = sprite.size / 100
    const dist = {
      left: s * sprite.costume.center.x,
      right: s * (sprite.costume.width - sprite.costume.center.x),
      up: s * sprite.costume.center.y,
      down: s * (sprite.costume.height - sprite.costume.center.y)
    }

    const spriteDirRad = sprite.scratchToRad(sprite.direction)
    const angle = {
      left: spriteDirRad + Math.PI,
      right: spriteDirRad,
      up: spriteDirRad - Math.PI / 2,
      down: spriteDirRad + Math.PI / 2
    }

    const movePoint = (pt, angle, dist) => ({
      x: pt.x + Math.cos(angle) * dist,
      y: pt.y + Math.sin(angle) * dist
    })

    const points = [
      movePoint(movePoint(origin, angle.up, dist.up), angle.right, dist.right),
      movePoint(movePoint(origin, angle.up, dist.up), angle.left, dist.left),
      movePoint(movePoint(origin, angle.down, dist.down), angle.right, dist.right),
      movePoint(movePoint(origin, angle.down, dist.down), angle.left, dist.left),
    ]

    return {
      left: Math.round(Math.min.apply(Math, points.map(pt => pt.x))),
      right: Math.round(Math.max.apply(Math, points.map(pt => pt.x))),
      top: Math.round(Math.min.apply(Math, points.map(pt => pt.y))),
      bottom: Math.round(Math.max.apply(Math, points.map(pt => pt.y)))
    }
  }
}