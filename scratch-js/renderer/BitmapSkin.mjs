import Skin from "./Skin.mjs";

export default class BitmapSkin extends Skin {
  constructor (renderer, image) {
    super(renderer);

    this._image = image;
    this._texture = null;
  }

  getTexture (scale) {
    const image = this._image;
    if (!image.complete) return null;

    const gl = this.gl;

    if (this._texture === null) {
	  // Use nearest-neighbor (i.e. blocky) texture filtering for bitmaps
      this._texture = super._makeTexture(image, this.gl.NEAREST);
    }
    return this._texture;
  }

  destroy () {
    if (this._texture !== null) this.gl.deleteTexture(this._texture);
  }
}