import Skin from "./Skin.js";
import ShaderManager from "./ShaderManager.js";

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
      gl.uniform2f(shader.uniforms.u_penSkinSize, this.width, this.height);
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
      gl.uniform4f(
        shader.uniforms.u_penColor,
        penColor[0] * penColor[3],
        penColor[1] * penColor[3],
        penColor[2] * penColor[3],
        penColor[3]
      );
    }

    // Only set the pen size if it changed or the shader changed.
    if (shaderChanged || this._lastPenState.size !== size) {
      this._lastPenState.size = size;
      gl.uniform1f(shader.uniforms.u_penSize, size);
    }

    const lineDiffX = pt2.x - pt1.x;
    const lineDiffY = pt2.y - pt1.y;

    gl.uniform4f(
      shader.uniforms.u_penPoints,
      pt1.x,
      pt1.y,
      lineDiffX,
      lineDiffY
    );

    // Fun fact: Doing this calculation in the shader has the potential to overflow the floating-point range.
    // 'mediump' precision is only required to have a range up to 2^14 (16384), so any lines longer than 2^7 (128)
    // can overflow that, because you're squaring the operands, and they could end up as "infinity".
    // Even GLSL's `length` function won't save us here:
    // https://asawicki.info/news_1596_watch_out_for_reduced_precision_normalizelength_in_opengl_es
    const lineLength = Math.sqrt(lineDiffX * lineDiffX + lineDiffY * lineDiffY);
    gl.uniform1f(shader.uniforms.u_lineLength, lineLength);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  clear() {
    this.renderer._setFramebuffer(this._framebufferInfo);
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
}
