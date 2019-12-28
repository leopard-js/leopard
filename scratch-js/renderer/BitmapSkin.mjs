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
      const gl = this.gl;
      const glTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, glTexture);
      // These need to be set because most sprite textures don't have power-of-two dimensions.
      // Non-power-of-two textures only work with gl.CLAMP_TO_EDGE wrapping behavior,
      // and because they don't support automatic mipmaps, can only use non-mipmap texture filtering.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	  // Use nearest-neighbor (e.g. blocky) texture filtering for bitmaps
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
      );

      this._texture = glTexture;
    }
    return this._texture;
  }

  destroy () {
    if (this._texture !== null) this.gl.deleteTexture(this._texture);
  }
}