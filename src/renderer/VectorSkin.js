import Skin from "./Skin.js";

// This means that the smallest mipmap will be 1/(2**4)th the size of the sprite's "100%" size.
const MIPMAP_OFFSET = 4;

export default class VectorSkin extends Skin {
  constructor(renderer, image) {
    super(renderer);

    this._image = image;
    this._canvas = document.createElement("canvas");

    this._maxTextureSize = renderer.gl.getParameter(
      renderer.gl.MAX_TEXTURE_SIZE
    );

    this._setSizeFromImage(image);

    this._mipmaps = new Map();
  }

  // TODO: handle proper subpixel positioning when SVG viewbox has non-integer coordinates
  // This will require rethinking costume + project loading probably
  _createMipmap(mipLevel) {
    const scale = 2 ** (mipLevel - MIPMAP_OFFSET);

    // Instead of uploading the image to WebGL as a texture, render the image to a canvas and upload the canvas.
    const canvas = this._canvas;
    const ctx = canvas.getContext("2d");

    const image = this._image;
    let width = image.naturalWidth * scale;
    let height = image.naturalHeight * scale;

    width = Math.round(Math.min(width, this._maxTextureSize));
    height = Math.round(Math.min(height, this._maxTextureSize));

    // Prevent IndexSizeErrors if the image is too small to render
    if (width === 0 || height === 0) {
      this._mipmaps.set(mipLevel, null);
      return;
    }

    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(image, 0, 0, width, height);

    // Use linear (i.e. smooth) texture filtering for vectors
    this._mipmaps.set(mipLevel, this._makeTexture(canvas, this.gl.LINEAR));
  }

  getTexture(scale) {
    const image = this._image;
    if (!image.complete) return null;

    // Because WebGL doesn't support vector graphics, substitute a bunch of bitmaps.
    // This skin contains several renderings of its image at different scales.
    // We render the SVG at 0.5x scale, 1x scale, 2x scale, 4x scale, etc. and store those as textures,
    // so we can use the properly-sized texture for whatever scale we're currently rendering at.
    // Math.ceil(Math.log2(scale)) means we use the "2x" texture at 1x-2x scale, the "4x" texture at 2x-4x scale, etc.
    // This means that one texture pixel will always be between 0.5x and 1x the size of one rendered pixel,
    // but never bigger than one rendered pixel--this prevents blurriness from blowing up the texture too much.
    const mipLevel = Math.max(Math.ceil(Math.log2(scale)) + MIPMAP_OFFSET, 0);
    if (!this._mipmaps.has(mipLevel)) this._createMipmap(mipLevel);

    return this._mipmaps.get(mipLevel);
  }

  destroy() {
    for (const mip of this._mipmaps.values()) {
      this.gl.deleteTexture(mip);
    }
  }
}
