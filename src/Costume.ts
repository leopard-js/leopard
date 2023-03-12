export default class Costume {
  public name: string;
  public url: string;
  public img: HTMLImageElement;
  public isBitmap: boolean;
  public resolution: 2 | 1;
  public center: { x: number; y: number };

  public constructor(name: string, url: string, center = { x: 0, y: 0 }) {
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

  public get width(): number {
    return this.img.naturalWidth;
  }

  public get height(): number {
    return this.img.naturalHeight;
  }
}
