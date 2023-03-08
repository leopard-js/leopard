import type Renderer from "../Renderer";

export default abstract class Skin {
  protected renderer: Renderer;
  protected gl: WebGLRenderingContext;
  public width: number;
  public height: number;

  public constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.gl = renderer.gl;
    this.width = 0;
    this.height = 0;
  }

  // Get the skin's texture for a given (screen-space) scale.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public abstract getTexture(scale: number): WebGLTexture | null;

  // Get the skin image's ImageData at a given (screen-space) scale.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getImageData(scale: number): ImageData | null {
    throw new Error("getImageData not implemented for this skin type");
  }

  // Helper function to create a texture from an image and handle all the boilerplate.
  protected _makeTexture(
    image: HTMLImageElement | HTMLCanvasElement | null,
    filtering:
      | WebGLRenderingContext["NEAREST"]
      | WebGLRenderingContext["LINEAR"]
  ): WebGLTexture {
    const gl = this.gl;
    const glTexture = gl.createTexture();
    if (!glTexture) throw new Error("Could not create texture");
    gl.bindTexture(gl.TEXTURE_2D, glTexture);
    // These need to be set because most sprite textures don't have power-of-two dimensions.
    // Non-power-of-two textures only work with gl.CLAMP_TO_EDGE wrapping behavior,
    // and because they don't support automatic mipmaps, can only use non-mipmap texture filtering.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filtering);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filtering);
    if (image)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
      );

    return glTexture;
  }

  // Helper function to set this skin's size based on an image that may or may not be loaded.
  protected _setSizeFromImage(image: HTMLImageElement): void {
    if (image.complete) {
      this.width = image.naturalWidth;
      this.height = image.naturalHeight;
    } else {
      image.addEventListener("load", () => {
        this.width = image.naturalWidth;
        this.height = image.naturalHeight;
      });
    }
  }

  // Clean up any textures or other objets created by this skin.
  public abstract destroy(): void;
}
