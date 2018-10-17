export default class Renderer {
  constructor(container) {
    if (typeof container === 'string') {
      container = document.querySelector(container)
    }
    this.container = container

    this.stage = document.createElement('div')
    this.stage.style.border = '1px solid black'
    this.stage.style.overflow = 'hidden'
    this.stage.style.width = '480px' // TODO: Allow changing stage size
    this.stage.style.height = '360px'

    this.container.append(this.stage)
  }

  update(sprites) {
    this.stage.innerHTML = ''
    sprites.forEach(sprite => {
      const elem = document.createElement('div')
      elem.innerHTML = sprite.costume.image

      if (typeof sprite.costume.width !== 'undefined') {
        elem.style.width = sprite.costume.width + 'px'
      }
      if (typeof sprite.costume.height !== 'undefined') {
        elem.style.height = sprite.costume.height + 'px'
      }
      elem.style.transform = `rotate(${sprite.direction - 90}deg) translate(${sprite.x}px, ${sprite.y}px) scale(${sprite.size / 100})`
      
      this.stage.append(elem)
    })
  }
}