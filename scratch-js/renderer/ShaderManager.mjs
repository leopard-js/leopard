import Shaders from './Shaders.mjs';

// Everything contained in a shader. It contains both the program, and the locations of the shader inputs.
class Shader {
  constructor (gl, program) {
    this.gl = gl;
    this.program = program;
    this._uniformLocations = new Map();
    this._attribLocations = new Map();
  }

  // In order to pass a value into a shader as an attribute or uniform, you need to know its location.
  // That's what these two functions do. You give them the name of an attribute or uniform,
  // and they tell you where the attribute or uniform is located so you can specify its value.
  attrib (attribName) {
    if (!this._attribLocations.has(attribName))
      this._attribLocations.set(attribName, this.gl.getAttribLocation(this.program, attribName));

    return this._attribLocations.get(attribName);
  }

  uniform (uniformName) {
    if (!this._uniformLocations.has(uniformName))
      this._uniformLocations.set(uniformName, this.gl.getUniformLocation(this.program, uniformName));

    return this._uniformLocations.get(uniformName);
  }
}

class ShaderManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.gl = renderer.gl;

    this._shaderCache = new Map();
  }

  // Creates and compiles a vertex or fragment shader from the given source code.
  _createShader (source, type) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      throw 'Could not compile WebGL program. \n' + info;
    }

    return shader;
  }

  // TODO: compile different shaders for each different draw mode.
  getShader (drawMode) {
    const gl = this.gl;
    if (this._shaderCache.has(drawMode)) {
      return this._shaderCache.get(drawMode);
    } else {
      this._currentShader = drawMode;

      const vertShader = this._createShader(Shaders.vertex, gl.VERTEX_SHADER);
      const fragShader = this._createShader(Shaders.fragment, gl.FRAGMENT_SHADER);

      // Combine the vertex and fragment shaders into a single GL program.
      const program = gl.createProgram();
      gl.attachShader(program, vertShader);
      gl.attachShader(program, fragShader);
      gl.linkProgram(program);

      const shader = new Shader(gl, program);
      this._shaderCache.set(drawMode, shader);
      return shader;
    }
  }
}

// TODO: add more draw modes (e.g. "pen layer").
ShaderManager.DrawModes = {
  SPRITE: 'SPRITE'
}

// TODO: effects.

export default ShaderManager;