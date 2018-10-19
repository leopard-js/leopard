export default class Costume {
  constructor (name, url, center = { x: 0, y: 0 }) {
    this.name = name
    this.url = url

    this.img = new Image
    this.img.src = this.url

    this.center = center
  }
}