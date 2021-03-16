import { SpriteShader, PenLineShader } from "./Shaders.js";
import { effectNames, effectBitmasks } from "./effectInfo.js";

// Everything contained in a shader. It contains both the program, and the locations of the shader inputs.
class Shader {
  constructor(gl, program) {
    this.gl = gl;
    this.program = program;
    this.uniforms = {};
    this.attribs = {};

    // In order to pass a value into a shader as an attribute or uniform, you need to know its location.
    // This maps the names of attributes and uniforms to their locations, accessible via the `uniforms` and `attribs`
    // properties.
    const numActiveUniforms = gl.getProgramParameter(
      program,
      gl.ACTIVE_UNIFORMS
    );
    for (let i = 0; i < numActiveUniforms; i++) {
      const { name } = gl.getActiveUniform(program, i);
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }

    const numActiveAttributes = gl.getProgramParameter(
      program,
      gl.ACTIVE_ATTRIBUTES
    );
    for (let i = 0; i < numActiveAttributes; i++) {
      const { name } = gl.getActiveAttrib(program, i);
      this.attribs[name] = gl.getAttribLocation(program, name);
    }
  }
}

class ShaderManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.gl = renderer.gl;

    // We compile shaders on-demand. Create one shader cache per draw mode.
    this._shaderCache = {};
    for (const drawMode of Object.keys(ShaderManager.DrawModes)) {
      this._shaderCache[drawMode] = new Map();
    }
  }

  // Creates and compiles a vertex or fragment shader from the given source code.
  _createShader(source, type) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      throw "Could not compile WebGL program. \n" + info;
    }

    return shader;
  }

  getShader(drawMode, effectBitmask = 0) {
    const gl = this.gl;
    // Each combination of enabled effects is compiled to a different shader, with only the needed effect code.
    // Check if we've already compiled the shader with this set of enabled effects.
    const shaderMap = this._shaderCache[drawMode];
    if (shaderMap.has(effectBitmask)) {
      return shaderMap.get(effectBitmask);
    } else {
      let shaderCode;
      switch (drawMode) {
        case ShaderManager.DrawModes.DEFAULT:
        case ShaderManager.DrawModes.SILHOUETTE:
        case ShaderManager.DrawModes.COLOR_MASK: {
          shaderCode = SpriteShader;
          break;
        }

        case ShaderManager.DrawModes.PEN_LINE: {
          shaderCode = PenLineShader;
          break;
        }
      }

      // Use #define statements for conditional compilation in shader code.
      let define = `#define DRAW_MODE_${drawMode}\n`;

      // Add #defines for each enabled effect.
      for (let i = 0; i < effectNames.length; i++) {
        const effectName = effectNames[i];
        if ((effectBitmask & effectBitmasks[effectName]) !== 0) {
          define += `#define EFFECT_${effectName}\n`;
        }
      }

      const vertShader = this._createShader(
        define + shaderCode.vertex,
        gl.VERTEX_SHADER
      );
      const fragShader = this._createShader(
        define + shaderCode.fragment,
        gl.FRAGMENT_SHADER
      );

      // Combine the vertex and fragment shaders into a single GL program.
      const program = gl.createProgram();
      gl.attachShader(program, vertShader);
      gl.attachShader(program, fragShader);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        throw new Error("Could not compile WebGL program. \n" + info);
      }

      const shader = new Shader(gl, program);
      shaderMap.set(effectBitmask, shader);
      return shader;
    }
  }
}

ShaderManager.DrawModes = {
  // Used for drawing sprites normally
  DEFAULT: "DEFAULT",
  // Used for "touching" tests. Discards transparent pixels.
  SILHOUETTE: "SILHOUETTE",
  // Used for "color is touching color" tests. Only renders sprite colors which are close to the color passed in, and
  // discards all pixels of a different color.
  COLOR_MASK: "COLOR_MASK",
  // Used for drawing pen lines.
  PEN_LINE: "PEN_LINE"
};

export default ShaderManager;
