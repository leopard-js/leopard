export default class Costume {
  constructor(name, url, center = { x: 0, y: 0 }) {
    this.name = name;
    this.url = url;

    this.img = new Image();
    this.img.crossOrigin = "Anonymous";
    this.img.src = this.url;

    // TODO: this is super janky, but fixing this fully requires restructuring costume loading
    this.isBitmap = !this.url.match(/\.svg/);
    this.resolution = this.isBitmap ? 2 : 1;

    this.center = center;
  }

  get width() {
    return this.img.naturalWidth;
  }

  get height() {
    return this.img.naturalHeight;
  }
}
