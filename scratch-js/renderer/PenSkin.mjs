import Skin from "./Skin.mjs";
import ShaderManager from "./ShaderManager.mjs";

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
    gl.uniform4fv(shader.uniform('u_penColor'), color.toRGBANormalized());

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  clear() {
    this.renderer._setFramebuffer(this._framebuffer);
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
}