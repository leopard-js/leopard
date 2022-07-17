import Skin from "./Skin.js";

// This means that the smallest mipmap will be 1/(2**4)th the size of the sprite's "100%" size.
const MIPMAP_OFFSET = 4;

export default class VectorSkin extends Skin {
  constructor(renderer, image) {
    super(renderer);

    this._image = image;
    this._canvas = document.createElement("canvas");

    this._imageDataMipLevel = 0;
    this._imageData = null;

    this._maxTextureSize = renderer.gl.getParameter(
      renderer.gl.MAX_TEXTURE_SIZE
    );

    this._setSizeFromImage(image);

    this._mipmaps = new Map();
  }

  static mipLevelForScale(scale) {
    return Math.max(Math.ceil(Math.log2(scale)) + MIPMAP_OFFSET, 0);
  }

  getImageData(scale) {
    if (!this._image.complete) return null;

    // Round off the scale of the image data drawn to a given power-of-two mip level.
    const mipLevel = VectorSkin.mipLevelForScale(scale);
    if (!this._imageData || this._imageDataMipLevel !== mipLevel) {
      const canvas = this._drawSvgToCanvas(mipLevel);
      if (canvas === null) return null;

      // Cache image data so we can reuse it
      this._imageData = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height);
      this._imageDataMipLevel = mipLevel;
    }

    return this._imageData;
  }

  _drawSvgToCanvas(mipLevel) {
    const scale = 2 ** (mipLevel - MIPMAP_OFFSET);

    const image = this._image;
    let width = image.naturalWidth * scale;
    let height = image.naturalHeight * scale;

    width = Math.round(Math.min(width, this._maxTextureSize));
    height = Math.round(Math.min(height, this._maxTextureSize));

    // Prevent IndexSizeErrors if the image is too small to render
    if (width === 0 || height === 0) {
      return null;
    }

    // Instead of uploading the image to WebGL as a texture, render the image to a canvas and upload the canvas.
    const canvas = this._canvas;
    const ctx = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(image, 0, 0, width, height);
    return this._canvas;
  }

  // TODO: handle proper subpixel positioning when SVG viewbox has non-integer coordinates
  // This will require rethinking costume + project loading probably
  _createMipmap(mipLevel) {
    // Instead of uploading the image to WebGL as a texture, render the image to a canvas and upload the canvas.
    const canvas = this._drawSvgToCanvas(mipLevel);
    this._mipmaps.set(
      mipLevel,
      // Use linear (i.e. smooth) texture filtering for vectors
      // If the image is 0x0, we return null. Check for that.
      canvas === null ? null : this._makeTexture(canvas, this.gl.LINEAR)
    );
  }

  getTexture(scale) {
    if (!this._image.complete) return null;

    // Because WebGL doesn't support vector graphics, substitute a bunch of bitmaps.
    // This skin contains several renderings of its image at different scales.
    // We render the SVG at 0.5x scale, 1x scale, 2x scale, 4x scale, etc. and store those as textures,
    // so we can use the properly-sized texture for whatever scale we're currently rendering at.
    // Math.ceil(Math.log2(scale)) means we use the "2x" texture at 1x-2x scale, the "4x" texture at 2x-4x scale, etc.
    // This means that one texture pixel will always be between 0.5x and 1x the size of one rendered pixel,
    // but never bigger than one rendered pixel--this prevents blurriness from blowing up the texture too much.
    const mipLevel = VectorSkin.mipLevelForScale(scale);
    if (!this._mipmaps.has(mipLevel)) this._createMipmap(mipLevel);

    return this._mipmaps.get(mipLevel);
  }

  destroy() {
    for (const mip of this._mipmaps.values()) {
      this.gl.deleteTexture(mip);
    }
  }
}
