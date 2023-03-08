import { SpriteShader, PenLineShader } from "./Shaders.js";
import { effectNames, effectBitmasks } from "./effectInfo.js";
import type Renderer from "../Renderer.js";

// Everything contained in a shader. It contains both the program, and the locations of the shader inputs.
class Shader {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  // TODO: strongly type these
  uniforms: Record<string, WebGLUniformLocation>;
  attribs: Record<string, number>;

  constructor(gl: WebGLRenderingContext, program: WebGLProgram) {
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
    ) as number;
    for (let i = 0; i < numActiveUniforms; i++) {
      const { name } = gl.getActiveUniform(program, i)!;
      this.uniforms[name] = gl.getUniformLocation(program, name)!;
    }

    const numActiveAttributes = gl.getProgramParameter(
      program,
      gl.ACTIVE_ATTRIBUTES
    ) as number;
    for (let i = 0; i < numActiveAttributes; i++) {
      const { name } = gl.getActiveAttrib(program, i)!;
      this.attribs[name] = gl.getAttribLocation(program, name)!;
    }
  }
}

type DrawMode = keyof typeof ShaderManager["DrawModes"];

class ShaderManager {
  renderer: Renderer;
  gl: WebGLRenderingContext;

  _shaderCache: Record<DrawMode, Map<number, Shader>>;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.gl = renderer.gl;

    // We compile shaders on-demand. Create one shader cache per draw mode.
    this._shaderCache = {} as Record<DrawMode, Map<number, Shader>>;
    for (const drawMode of Object.keys(ShaderManager.DrawModes)) {
      this._shaderCache[drawMode as DrawMode] = new Map();
    }
  }

  // Creates and compiles a vertex or fragment shader from the given source code.
  _createShader(
    source: string,
    type:
      | WebGLRenderingContext["FRAGMENT_SHADER"]
      | WebGLRenderingContext["VERTEX_SHADER"]
  ): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Could not create shader.");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader) ?? "";
      throw new Error("Could not compile WebGL program. \n" + info);
    }

    return shader;
  }

  getShader(drawMode: DrawMode, effectBitmask = 0): Shader {
    const gl = this.gl;
    // Each combination of enabled effects is compiled to a different shader, with only the needed effect code.
    // Check if we've already compiled the shader with this set of enabled effects.
    const shaderMap = this._shaderCache[drawMode];
    const existingShader = shaderMap.get(effectBitmask);
    if (existingShader) return existingShader;

    let shaderCode;
    switch (drawMode) {
      case ShaderManager.DrawModes.PEN_LINE: {
        shaderCode = PenLineShader;
        break;
      }
      default: {
        shaderCode = SpriteShader;
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
    if (!program) throw new Error("Could not create program");
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program) ?? "";
      throw new Error("Could not compile WebGL program. \n" + info);
    }

    const shader = new Shader(gl, program);
    shaderMap.set(effectBitmask, shader);
    return shader;
  }

  static DrawModes = {
    // Used for drawing sprites normally
    DEFAULT: "DEFAULT",
    // Used for "touching" tests. Discards transparent pixels.
    SILHOUETTE: "SILHOUETTE",
    // Used for "color is touching color" tests. Only renders sprite colors which are close to the color passed in, and
    // discards all pixels of a different color.
    COLOR_MASK: "COLOR_MASK",
    // Used for picking the topmost sprite and identifying which one it is.
    // Assigns a color to each sprite.
    SPRITE_ID: "SPRITE_ID",
    // Used for drawing pen lines.
    PEN_LINE: "PEN_LINE",
  } as const;
}

export default ShaderManager;
export { Shader };
export type { DrawMode };
