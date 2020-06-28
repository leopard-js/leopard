import Skin from "./Skin.js";

export default class BitmapSkin extends Skin {
  constructor(renderer, image) {
    super(renderer);

    this._image = image;
    this._texture = null;

    this._setSizeFromImage(image);
  }

  getTexture() {
    // Make sure to handle potentially non-loaded textures
    const image = this._image;
    if (!image.complete) return null;

    if (this._texture === null) {
      // Use nearest-neighbor (i.e. blocky) texture filtering for bitmaps
      this._texture = super._makeTexture(image, this.gl.NEAREST);
    }
    return this._texture;
  }

  destroy() {
    if (this._texture !== null) this.gl.deleteTexture(this._texture);
  }
}
