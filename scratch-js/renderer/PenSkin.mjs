import Skin from "./Skin.mjs";
import ShaderManager from "./ShaderManager.mjs";

export default class PenSkin extends Skin {
  constructor(renderer, width, height) {
    super(renderer);
    this.width = width;
    this.height = height;

    const framebufferInfo = renderer._createFramebufferInfo(
      width,
      height,
      this.gl.NEAREST
    );
    this._framebufferInfo = framebufferInfo;

    this._lastPenState = {
      size: 0,
      color: [0, 0, 0, 0]
    };

    this.clear();
  }

  destroy() {
    const gl = this.gl;
    gl.deleteTexture(this._framebufferInfo.texture);
    gl.deleteFramebuffer(this._framebufferInfo.framebuffer);
  }

  getTexture() {
    return this._framebufferInfo.texture;
  }

  penLine(pt1, pt2, color, size) {
    const renderer = this.renderer;
    renderer._setFramebuffer(this._framebufferInfo);

    const shader = renderer._shaderManager.getShader(
      ShaderManager.DrawModes.PEN_LINE
    );

    const gl = this.gl;

    // Set the shader, and check if it actually changed.
    const shaderChanged = renderer._setShader(shader);

    // These uniforms only need to be set if the shader actually changed.
    if (shaderChanged) {
      gl.uniform2f(shader.uniform("u_penSkinSize"), this.width, this.height);
    }

    // Only set the pen color if it changed or the shader changed.
    const penColor = color.toRGBANormalized();
    const oldColor = this._lastPenState.color;
    if (
      shaderChanged ||
      penColor[0] !== oldColor[0] ||
      penColor[1] !== oldColor[1] ||
      penColor[2] !== oldColor[2] ||
      penColor[3] !== oldColor[3]
    ) {
      this._lastPenState.color = penColor;
      gl.uniform4fv(shader.uniform("u_penColor"), penColor);
    }

    // Only set the pen size if it changed or the shader changed.
    if (shaderChanged || this._lastPenState.size !== size) {
      this._lastPenState.size = size;
      gl.uniform1f(shader.uniform("u_penSize"), size);
    }

    gl.uniform4f(shader.uniform("u_penPoints"), pt1.x, pt1.y, pt2.x, pt2.y);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  clear() {
    this.renderer._setFramebuffer(this._framebufferInfo);
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
}
