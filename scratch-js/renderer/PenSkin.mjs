import Skin from "./Skin.mjs";
import ShaderManager from "./ShaderManager.mjs";

// Used for turning CSS colors into RGBA.
const __colorCanvas = document.createElement("canvas");

// Convert CSS color strings to RGBA colors whose values range from 0-1.
// This is an ugly hack that will go away once #22 is worked out.
const _cssColorToRGBAFloat = color => {
  const colorCtx = __colorCanvas.getContext('2d');
  colorCtx.fillStyle = color;
  colorCtx.fillRect(0, 0, 1, 1);
  const color4b = colorCtx.getImageData(0, 0, 1, 1).data;
  const color4f = new Float32Array(4);
  const alpha = color4b[3] / 255;
  color4f[0] = (color4b[0] / 255) * alpha;
  color4f[1] = (color4b[1] / 255) * alpha;
  color4f[2] = (color4b[2] / 255) * alpha;
  color4f[3] = alpha;

  return color4f;
}

export default class PenSkin extends Skin {
  constructor(renderer, width, height) {
    super(renderer);
    this.width = width;
    this.height = height;

    const {framebuffer, texture} = renderer._createFramebuffer(width, height, this.gl.NEAREST);
    this._framebuffer = framebuffer;
    this._texture = texture;

    this.clear();
  }

  destroy() {
    const gl = this.gl;
    gl.deleteTexture(this._texture);
    gl.deleteFramebuffer(this._framebuffer);
  }

  getTexture(scale) {
    return this._texture;
  }

  penLine(pt1, pt2, color, size) {
    const renderer = this.renderer;
    renderer._setFramebuffer(this._framebuffer);

    const shader = renderer._shaderManager.getShader(ShaderManager.DrawModes.PEN_LINE);
    renderer._setShader(shader);

    const gl = this.gl;
    gl.uniform1f(shader.uniform('u_penSize'), size);
    gl.uniform2f(shader.uniform('u_penSkinSize'), this.width, this.height);
    gl.uniform4f(shader.uniform('u_penPoints'), pt1.x, pt1.y, pt2.x, pt2.y);
    gl.uniform4fv(shader.uniform('u_penColor'), _cssColorToRGBAFloat(color));

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  clear() {
    this.renderer._setFramebuffer(this._framebuffer);
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
}