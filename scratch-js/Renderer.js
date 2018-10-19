export default class Renderer {
  constructor(container) {
    if (typeof container === 'string') {
      container = document.querySelector(container)
    }
    this.container = container

    this.stage = document.createElement('canvas')
    this.stage.style.border = '1px solid black'
    this.stage.width = 480
    this.stage.height = 360

    this.ctx = this.stage.getContext('2d')

    this.container.append(this.stage)
  }

  update(sprites) {
    this.ctx.clearRect(0, 0, this.stage.width, this.stage.height)

    sprites.forEach(spr => {
      this.ctx.save()

      this.ctx.setTransform(1, 0, 0, 1, 0, 0)
      this.ctx.translate(this.stage.width / 2, this.stage.height / 2)
      this.ctx.translate(spr.x, -spr.y)
      this.ctx.rotate(-spr.scratchToRad(spr.direction))
      this.ctx.scale(spr.size / 100, spr.size / 100)
      this.ctx.translate(-spr.costume.center.x, -spr.costume.center.y)
      
      this.ctx.drawImage(spr.costume.img, 0, 0)

      this.ctx.restore()
    })
  }
}