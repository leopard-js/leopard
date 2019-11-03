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

    this.penStage = this.createStage()
    this.penLayer = this.penStage.getContext('2d')
  }

  update(stage, sprites) {
    this.ctx.clearRect(0, 0, this.stage.width, this.stage.height)

    this.renderSprite(stage, this.ctx)

    this.ctx.drawImage(this.penStage, 0, 0)

    sprites.forEach(spr => {
      if (spr.visible) {
        this.renderSprite(spr, this.ctx)
      }
    })

    this.ctx.font = '12px monospace'
    this.ctx.fillStyle = '#aaa'
  }

  createStage(w = 480, h = 360) {
    const stage = document.createElement('canvas')
    stage.width = w
    stage.height = h

    return stage
  }

  renderSprite(spr, ctx) {
    ctx.save()

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

  checkSpriteCollision(spr1, spr2, fast) {
    const box1 = this.getBoundingBox(spr1)
    const box2 = this.getBoundingBox(spr2)

    if (box1.right <= box2.left) return false
    if (box1.left >= box2.right) return false
    if (box1.bottom <= box2.top) return false
    if (box1.top >= box2.bottom) return false

    if (fast) return true

    const left = Math.max(box1.left, box2.left)
    const right = Math.min(box1.right, box2.right)
    const top = Math.max(box1.top, box2.top)
    const bottom = Math.min(box1.bottom, box2.bottom)

    const collisionStage = this.createStage(right - left, bottom - top)
    collisionStage.style.border = '1px solid black'
    const collisionCtx = collisionStage.getContext('2d')

    collisionCtx.setTransform(1, 0, 0, 1, 0, 0)
    collisionCtx.translate(-left, -top)

    collisionCtx.globalCompositeOperation = 'source-over'
    this.renderSprite(spr1, collisionCtx)
    
    collisionCtx.globalCompositeOperation = 'source-in'
    this.renderSprite(spr2, collisionCtx)

    // If collision stage contains any alpha > 0, there's a collision
    const w = collisionStage.width
    const h = collisionStage.height
    const imgData = collisionCtx.getImageData(0, 0, w, h).data

    const length = w * h * 4
    for (let i = 0; i < length; i += 4) {
      if (imgData[i + 3] > 0) {
        return true
      }
    }

    return false
  }

  penLine(pt1, pt2, color, size) {
    this.penLayer.lineWidth = size
    this.penLayer.strokeStyle = color
    this.penLayer.lineCap = 'round'

    this.penLayer.beginPath()
    this.penLayer.moveTo(pt1.x + 240, 180 - pt1.y)
    this.penLayer.lineTo(pt2.x + 240, 180 - pt2.y)
    this.penLayer.stroke()
  }

  clearPen() {
    this.penLayer.clearRect(0, 0, this.penStage.width, this.penStage.height)
  }

  stamp(sprite) {
    this.renderSprite(sprite, this.penLayer)
  }
}