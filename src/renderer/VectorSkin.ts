import Skin from "./Skin";
import type Renderer from "../Renderer";

// This means that the smallest mipmap will be 1/(2**4)th the size of the sprite's "100%" size.
const MIPMAP_OFFSET = 4;

export default class VectorSkin extends Skin {
  private _image: HTMLImageElement;
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;
  private _imageDataMipLevel: number;
  private _imageData: ImageData | null;
  private _maxTextureSize: number;
  private _mipmaps: Map<number, WebGLTexture | null>;

  public constructor(renderer: Renderer, image: HTMLImageElement) {
    super(renderer);

    this._image = image;
    this._canvas = document.createElement("canvas");
    const ctx = this._canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");
    this._ctx = ctx;

    this._imageDataMipLevel = 0;
    this._imageData = null;

    this._maxTextureSize = renderer.gl.getParameter(
      renderer.gl.MAX_TEXTURE_SIZE
    ) as number;

    this._setSizeFromImage(image);

    this._mipmaps = new Map();
  }

  private static mipLevelForScale(scale: number): number {
    return Math.max(Math.ceil(Math.log2(scale)) + MIPMAP_OFFSET, 0);
  }

  public getImageData(scale: number): ImageData | null {
    if (!this._image.complete) return null;

    // Round off the scale of the image data drawn to a given power-of-two mip level.
    const mipLevel = VectorSkin.mipLevelForScale(scale);
    if (!this._imageData || this._imageDataMipLevel !== mipLevel) {
      const ctx = this._drawSvgToCanvas(mipLevel);
      if (ctx === null) return null;
      const { canvas } = ctx;

      // Cache image data so we can reuse it
      this._imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      this._imageDataMipLevel = mipLevel;
    }

    return this._imageData;
  }

  private _drawSvgToCanvas(mipLevel: number): CanvasRenderingContext2D | null {
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
    const ctx = this._ctx;
    const { canvas } = ctx;

    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(image, 0, 0, width, height);
    return ctx;
  }

  // TODO: handle proper subpixel positioning when SVG viewbox has non-integer coordinates
  // This will require rethinking costume + project loading probably
  private _createMipmap(mipLevel: number): void {
    // Instead of uploading the image to WebGL as a texture, render the image to a canvas and upload the canvas.
    const ctx = this._drawSvgToCanvas(mipLevel);
    this._mipmaps.set(
      mipLevel,
      // Use linear (i.e. smooth) texture filtering for vectors
      // If the image is 0x0, we return null. Check for that.
      ctx === null ? null : this._makeTexture(ctx.canvas, this.gl.LINEAR)
    );
  }

  public getTexture(scale: number): WebGLTexture | null {
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

    return this._mipmaps.get(mipLevel) ?? null;
  }

  public destroy(): void {
    for (const mip of this._mipmaps.values()) {
      this.gl.deleteTexture(mip);
    }
  }
}
