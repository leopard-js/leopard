export default class Renderer {
  constructor(renderTarget, { w = 480, h = 360 } = {}) {
    this.stage = this.createStage(w, h)
    this.ctx = this.stage.getContext('2d')

    if (renderTarget !== undefined) {
      this.setRenderTarget(renderTarget)
    } else {
      this.renderTarget = null
    }

    this.penStage = this.createStage(w, h)
    this.penLayer = this.penStage.getContext('2d')
  }

  setRenderTarget(renderTarget) {
    if (typeof renderTarget === 'string') {
      renderTarget = document.querySelector(renderTarget)
    }
    this.renderTarget = renderTarget
    this.renderTarget.style.width = `${this.stage.width}px`
    this.renderTarget.style.height = `${this.stage.height}px`

    this.renderTarget.append(this.stage)
  }

  update(stage, sprites) {
    this.ctx.clearRect(0, 0, this.stage.width, this.stage.height)

    this.renderSprite(stage, this.ctx)

    this.ctx.drawImage(this.penStage, 0, 0)

    for (const sprite of Object.values(sprites)) {
      if (sprite.visible) {
        this.renderSprite(sprite, this.ctx)
        if (sprite._speechBubble.text) {
          this.renderSpriteSpeechBubble(sprite, this.ctx)
        }
      }
    }

    this.ctx.font = '12px monospace'
    this.ctx.fillStyle = '#aaa'
  }

  createStage(w, h) {
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

  renderSpriteSpeechBubble(spr, ctx) {
    const renderBubble = (x, y, w, h, r, style) => {
      if (r > w / 2) r = w / 2
      if (r > h / 2) r = h / 2
      if (r < 0) return
      
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.arcTo(x + w, y, x + w, y + h, r)
      ctx.arcTo(x + w, y + h, x + r, y + h, r)
      if (style === 'say') {
        ctx.lineTo(Math.min(x + 3 * r, x + w - r), y + h)
        ctx.lineTo(x + r / 2, y + h + r)
        ctx.lineTo(x + r, y + h)
      } else if (style === 'think') {
        ctx.ellipse(x + r * 2.25, y + h, r * 3 / 4, r / 2, 0, 0, Math.PI)
      }
      ctx.arcTo(x, y + h, x, y, r)
      ctx.arcTo(x, y, x + w, y, r)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      if (style === 'think') {
        ctx.beginPath()
        ctx.ellipse(x + r, y + h + r * 3 / 4, r / 3, r / 3, 0, 0, 2 * Math.PI)
        ctx.fill()
        ctx.stroke()
      }
    }
    
    const box = this.getBoundingBox(spr)

    ctx.font = '16px sans-serif'
    ctx.textBaseline = 'hanging'

    const { text, style } = spr._speechBubble
    let { width } = ctx.measureText(text)

    const maxWidth = this.stage.width - box.right
    const padding = 12

    width = Math.min(width + 2 * padding, maxWidth)
    const height = 10 + 2 * padding
    const x = box.right
    const y = box.top - height

    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#ccc'
    ctx.lineWidth = 2
    renderBubble(x, y, width, height, 12, style)

    ctx.fillStyle = '#444'
    ctx.fillText(
      text,
      x + padding,
      y + padding,
      maxWidth - 2 * padding
    )
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
    if (!spr1.visible) return false
    if (!spr2.visible) return false
    
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

  checkPointCollision(spr, point, fast) {
    if (!spr.visible) return false

    const box = this.getBoundingBox(spr)

    if (box.right < point.x) return false
    if (box.left > point.x) return false
    if (box.top > point.y) return false
    if (box.bottom < point.y) return false

    if (fast) return true

    const collisionStage = this.createStage(box.right - box.left, box.bottom - box.top)
    const collisionCtx = collisionStage.getContext('2d')

    collisionCtx.setTransform(1, 0, 0, 1, 0, 0)
    collisionCtx.translate(-box.left, -box.top)

    this.renderSprite(spr, collisionCtx)

    const w = collisionStage.width
    const h = collisionStage.height
    const imgData = collisionCtx.getImageData(0, 0, w, h).data

    // Check if point has alpha > 0
    const x = point.x - box.left
    const y = point.y - box.top
    return imgData[(y * w + x) * 4 + 3] > 0
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