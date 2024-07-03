import Matrix, { MatrixType } from "./renderer/Matrix";
import Drawable from "./renderer/Drawable";
import BitmapSkin from "./renderer/BitmapSkin";
import PenSkin from "./renderer/PenSkin";
import SpeechBubbleSkin from "./renderer/SpeechBubbleSkin";
import VectorSkin from "./renderer/VectorSkin";
import Rectangle from "./renderer/Rectangle";
import ShaderManager, { Shader, DrawMode } from "./renderer/ShaderManager";
import { effectNames, effectBitmasks } from "./renderer/effectInfo";
import type Skin from "./renderer/Skin";

import Costume from "./Costume";
import type Color from "./Color";
import type { RGBANormalized } from "./Color";
import type Project from "./Project";
import { Sprite, Stage, _EffectMap, SpeechBubble } from "./Sprite";

// Rectangle used for checking collision bounds.
// Rather than create a new one each time, we can just reuse this one.
const __collisionBox = new Rectangle();

// Convert a sprite ID/index number to a 24-bit color. The lowest 8 bits are
// stored in the blue channel, then green, then red.
// RGB [0, 0, 0] is reserved for "no sprite here".
// This allows for up to 2^24 - 2 different sprites to be rendered at once.
const idToColor = (id: number): [number, number, number] => [
  (((id + 1) >> 16) & 0xff) / 255,
  (((id + 1) >> 8) & 0xff) / 255,
  ((id + 1) & 0xff) / 255,
];

// Convert a 24-bit color back into a sprite ID/index number.
// -1 means "no sprite here".
const colorToId = ([r, g, b]: [number, number, number] | Uint8Array): number =>
  ((r << 16) | (g << 8) | b) - 1;

type RenderSpriteOptions = {
  drawMode: DrawMode;
  effectMask?: number;
  colorMask?: RGBANormalized;
  renderSpeechBubbles?: boolean;
  spriteColorId?: (target: Sprite | Stage) => number;
};

export type FramebufferInfo = {
  texture: WebGLTexture;
  width: number;
  height: number;
  framebuffer: WebGLFramebuffer;
};

export default class Renderer {
  public project: Project;
  public stage: HTMLCanvasElement;
  public gl: WebGLRenderingContext;
  public renderTarget: HTMLElement | null = null;

  public _shaderManager: ShaderManager;
  private _drawables: WeakMap<Sprite | Stage, Drawable>;
  private _skins: WeakMap<object, Skin>;

  private _currentShader: Shader | null;
  private _currentFramebuffer: WebGLFramebuffer | null;
  private _screenSpaceScale: number;
  private _penSkin: PenSkin;
  private _collisionBuffer: FramebufferInfo;

  public constructor(
    project: Project,
    renderTarget: HTMLElement | string | null
  ) {
    const w = project.stage.width;
    const h = project.stage.height;
    this.project = project;
    this.stage = Renderer.createStage(w, h);
    const gl = this.stage.getContext("webgl", { antialias: false });
    if (gl === null) throw new Error("Could not initialize WebGL context");
    this.gl = gl;

    if (renderTarget) {
      this.setRenderTarget(renderTarget);
    } else {
      this.renderTarget = null;
    }

    this._shaderManager = new ShaderManager(this);
    this._drawables = new WeakMap();
    this._skins = new WeakMap();

    this._currentShader = null;
    this._currentFramebuffer = null;
    this._screenSpaceScale = 1;

    // Initialize a bunch of WebGL state

    // Use premultiplied alpha for proper color blending.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

    // Initialize vertex buffer. This will draw one 2D quadrilateral.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    // These are 6 points which make up 2 triangles which make up 1 quad/rectangle.
    gl.bufferData(
      gl.ARRAY_BUFFER,
      // Prettier mangles the formatting here but every 2 array values make one (x, y) pair
      // and every 6 values make one triangle
      new Float32Array([0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0]),
      gl.STATIC_DRAW
    );

    // Set the active texture unit to 0.
    gl.activeTexture(gl.TEXTURE0);

    this._penSkin = new PenSkin(this, w, h);

    // This framebuffer is where sprites are drawn for e.g. "touching" checks.
    this._collisionBuffer = this._createFramebufferInfo(
      w,
      h,
      gl.NEAREST,
      true // stencil
    );
  }

  // Retrieve a given object (e.g. costume or speech bubble)'s skin. If it doesn't exist, make one.
  public _getSkin(obj: Costume | SpeechBubble): Skin {
    const existingSkin = this._skins.get(obj);
    if (existingSkin) return existingSkin;

    let skin;

    if (obj instanceof Costume) {
      if (obj.isBitmap) {
        skin = new BitmapSkin(this, obj.img);
      } else {
        skin = new VectorSkin(this, obj.img);
      }
    } else {
      // If it's not a costume, assume it's a speech bubble.
      skin = new SpeechBubbleSkin(this, obj);
    }
    this._skins.set(obj, skin);
    return skin;
  }

  // Retrieve the renderer-specific data object for a given sprite or clone. If it doesn't exist, make one.
  public _getDrawable(sprite: Sprite | Stage): Drawable {
    const existingDrawable = this._drawables.get(sprite);
    if (existingDrawable) return existingDrawable;

    const drawable = new Drawable(this, sprite);
    this._drawables.set(sprite, drawable);
    return drawable;
  }

  // Create a framebuffer info object, which contains the following:
  // * The framebuffer itself.
  // * The texture backing the framebuffer.
  // * The resolution (width and height) of the framebuffer.
  public _createFramebufferInfo(
    width: number,
    height: number,
    filtering:
      | WebGLRenderingContext["NEAREST"]
      | WebGLRenderingContext["LINEAR"],
    stencil = false
  ): FramebufferInfo {
    // Create an empty texture with this skin's dimensions.
    const gl = this.gl;
    const texture = gl.createTexture();
    if (texture === null) throw new Error("Could not create texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filtering);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filtering);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );

    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) throw new Error("Could not create framebuffer");

    // Create a framebuffer backed by said texture. This means we can draw onto the framebuffer,
    // and the results appear in the texture.
    const framebufferInfo = {
      texture,
      width,
      height,
      framebuffer,
    };
    this._setFramebuffer(framebufferInfo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );

    // The depth buffer is unnecessary, but WebGL only guarantees
    // that certain combinations of framebuffer attachments will work, and "stencil but no depth" is not among them.
    if (stencil) {
      const renderbuffer = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, width, height);
      gl.framebufferRenderbuffer(
        gl.FRAMEBUFFER,
        gl.DEPTH_STENCIL_ATTACHMENT,
        gl.RENDERBUFFER,
        renderbuffer
      );
    }

    return framebufferInfo;
  }

  public _setShader(shader: Shader): boolean {
    if (shader === this._currentShader) return false;

    const gl = this.gl;
    gl.useProgram(shader.program);

    // These attributes and uniforms don't ever change, but must be set whenever a new shader program is used.

    const attribLocation = shader.attribs.a_position;
    gl.enableVertexAttribArray(attribLocation);
    // Bind the 'a_position' vertex attribute to the current contents of `gl.ARRAY_BUFFER`, which in this case
    // is a quadrilateral (as buffered earlier).
    gl.vertexAttribPointer(
      attribLocation,
      2, // every 2 array elements make one vertex.
      gl.FLOAT, // data type
      false, // normalized
      0, // stride (space between attributes)
      0 // offset (index of the first attribute to start from)
    );

    this._currentShader = shader;
    this._updateStageSize();

    return true;
  }

  public _setFramebuffer(framebufferInfo: FramebufferInfo | null): void {
    if (framebufferInfo !== this._currentFramebuffer) {
      this._currentFramebuffer = framebufferInfo;
      if (framebufferInfo === null) {
        // The "null" framebuffer means the drawing buffer which we're displaying to the screen.
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this._updateStageSize();
      } else {
        this.gl.bindFramebuffer(
          this.gl.FRAMEBUFFER,
          framebufferInfo.framebuffer
        );
        // Make sure to update the drawing viewport to the current framebuffer size.
        this.gl.viewport(0, 0, framebufferInfo.width, framebufferInfo.height);
      }
    }
  }

  public setRenderTarget(renderTarget: HTMLElement | string | null): void {
    if (typeof renderTarget === "string") {
      renderTarget = document.querySelector(renderTarget) as HTMLElement;
    }
    this.renderTarget = renderTarget;
    if (!renderTarget) return;
    renderTarget.classList.add("leopard__project");
    renderTarget.style.width = `${this.project.stage.width}px`;
    renderTarget.style.height = `${this.project.stage.height}px`;

    renderTarget.append(this.stage);
  }

  // Handles rendering of all layers (including stage, pen layer, sprites, and all clones) in proper order.
  private _renderLayers(
    layers?: Set<Sprite | Stage | PenSkin>,
    optionsIn: Partial<RenderSpriteOptions> = {},
    filter?: (layer: Sprite | Stage | PenSkin) => boolean
  ): void {
    const options = {
      drawMode: ShaderManager.DrawModes.DEFAULT,
      ...optionsIn,
    };

    // If we're given a list of layers, filter by that.
    // If we're given a filter function in the options, filter by that too.
    // If we're given both, then only include layers which match both.
    const shouldRestrictLayers = layers instanceof Set;
    const shouldIncludeLayer = (layer: Sprite | Stage | PenSkin): boolean =>
      !(
        (shouldRestrictLayers && !layers.has(layer)) ||
        (filter && !filter(layer))
      );

    // Stage
    if (shouldIncludeLayer(this.project.stage)) {
      this.renderSprite(this.project.stage, options);
    }

    // Pen layer
    if (shouldIncludeLayer(this._penSkin)) {
      const penMatrix = Matrix.create();
      Matrix.scale(
        penMatrix,
        penMatrix,
        this._penSkin.width,
        -this._penSkin.height
      );
      Matrix.translate(penMatrix, penMatrix, -0.5, -0.5);

      this._renderSkin(
        this._penSkin,
        options.drawMode,
        penMatrix,
        1 /* scale */
      );
    }

    // Sprites + clones
    for (const sprite of this.project.spritesAndClones) {
      // Stage doesn't have "visible" defined, so check if it's strictly false
      if (shouldIncludeLayer(sprite) && sprite.visible !== false) {
        this.renderSprite(sprite, options);
      }
    }
  }

  private _updateStageSize(): void {
    if (this._currentShader) {
      // The shader is passed things in "Scratch-space" (-240, 240) and (-180, 180).
      // This tells it those dimensions so it can convert them to OpenGL "clip-space" (-1, 1).
      this.gl.uniform2f(
        this._currentShader.uniforms.u_stageSize,
        this.project.stage.width,
        this.project.stage.height
      );
    }

    if (this._currentFramebuffer === null) {
      this.gl.viewport(
        0,
        0,
        this.gl.drawingBufferWidth,
        this.gl.drawingBufferHeight
      );
    }
  }

  // Keep the canvas size in sync with the CSS size.
  private _resize(): void {
    const stageSize = this.stage.getBoundingClientRect();
    const ratio = window.devicePixelRatio;
    const adjustedWidth = Math.round(stageSize.width * ratio);
    const adjustedHeight = Math.round(stageSize.height * ratio);
    if (
      this.stage.width !== adjustedWidth ||
      this.stage.height !== adjustedHeight
    ) {
      this.stage.width = adjustedWidth;
      this.stage.height = adjustedHeight;
      this._screenSpaceScale = Math.max(
        adjustedWidth / this.project.stage.width,
        adjustedHeight / this.project.stage.height
      );

      this._updateStageSize();
    }
  }

  public update(): void {
    this._resize();

    // Draw to the screen, not to a framebuffer.
    this._setFramebuffer(null);

    // Clear to opaque white.
    const gl = this.gl;
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this._renderLayers();
  }

  private static createStage(w: number, h: number): HTMLCanvasElement {
    const stage = document.createElement("canvas");
    stage.width = w;
    stage.height = h;

    // Size canvas to parent container
    stage.style.width = stage.style.height = "100%";

    // If the container width is a non-integer size, don't blur the canvas.
    // Chrome:
    stage.style.imageRendering = "pixelated";
    // Firefox:
    stage.style.imageRendering = "crisp-edges";
    // Safari + Opera:
    stage.style.imageRendering = "-webkit-optimize-contrast";

    return stage;
  }

  // Calculate the transform matrix for a speech bubble attached to a sprite.
  private _calculateSpeechBubbleMatrix(
    spr: Sprite,
    speechBubbleSkin: SpeechBubbleSkin
  ): MatrixType {
    const sprBounds = this.getBoundingBox(spr);
    let x;
    if (
      speechBubbleSkin.width + sprBounds.right >
      this.project.stage.width / 2
    ) {
      x = sprBounds.left - speechBubbleSkin.width;
      speechBubbleSkin.flipped = true;
    } else {
      x = sprBounds.right;
      speechBubbleSkin.flipped = false;
    }
    x = Math.round(x - speechBubbleSkin.offsetX);
    const y = Math.round(sprBounds.top - speechBubbleSkin.offsetY);

    const m = Matrix.create();
    Matrix.translate(m, m, x, y);
    Matrix.scale(m, m, speechBubbleSkin.width, speechBubbleSkin.height);

    return m;
  }

  private _renderSkin(
    skin: Skin,
    drawMode: DrawMode,
    matrix: MatrixType,
    scale: number,
    effects?: _EffectMap,
    effectMask?: number,
    colorMask?: RGBANormalized,
    spriteColorId?: number
  ): void {
    const gl = this.gl;

    const skinTexture = skin.getTexture(scale * this._screenSpaceScale);
    // Skip rendering the skin if it has no texture.
    if (!skinTexture) return;

    let effectBitmask = effects ? effects._bitmask : 0;
    if (typeof effectMask === "number") effectBitmask &= effectMask;
    const shader = this._shaderManager.getShader(drawMode, effectBitmask);
    this._setShader(shader);
    gl.uniformMatrix3fv(shader.uniforms.u_transform, false, matrix);

    if (effectBitmask !== 0 && effects) {
      for (const effect of effectNames) {
        const effectVal = effects[effect];
        if (effectVal !== 0)
          gl.uniform1f(shader.uniforms[`u_${effect}`], effectVal);
      }

      // Pixelate effect needs the skin size
      if (effects.pixelate !== 0)
        gl.uniform2f(
          shader.uniforms.u_skinSize,
          skin.width ?? 0,
          skin.height ?? 0
        );
    }

    gl.bindTexture(gl.TEXTURE_2D, skinTexture);
    // All textures are bound to texture unit 0, so that's where the texture sampler should point
    gl.uniform1i(shader.uniforms.u_texture, 0);

    // Enable color masking mode if set
    if (Array.isArray(colorMask))
      this.gl.uniform4fv(shader.uniforms.u_colorMask, colorMask);

    // Used for mapping drawn sprites back to their indices in a list.
    // By looking at the color of a given pixel, we can tell which sprite is
    // the topmost one drawn on that pixel.
    if (
      drawMode === ShaderManager.DrawModes.SPRITE_ID &&
      typeof spriteColorId === "number"
    ) {
      this.gl.uniform3fv(shader.uniforms.u_spriteId, idToColor(spriteColorId));
    }

    // Actually draw the skin
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
  }

  private renderSprite(
    sprite: Sprite | Stage,
    options: RenderSpriteOptions
  ): void {
    const spriteScale = "size" in sprite ? sprite.size / 100 : 1;

    this._renderSkin(
      this._getSkin(sprite.costume),
      options.drawMode,
      this._getDrawable(sprite).getMatrix(),
      spriteScale,
      sprite.effects,
      options.effectMask,
      options.colorMask,
      options.spriteColorId ? options.spriteColorId(sprite) : undefined
    );

    if (
      options.renderSpeechBubbles !== false &&
      "_speechBubble" in sprite &&
      sprite._speechBubble &&
      sprite._speechBubble.text !== "" &&
      sprite instanceof Sprite
    ) {
      const speechBubbleSkin = this._getSkin(
        sprite._speechBubble
      ) as SpeechBubbleSkin;

      this._renderSkin(
        speechBubbleSkin,
        options.drawMode,
        this._calculateSpeechBubbleMatrix(sprite, speechBubbleSkin),
        1 /* spriteScale */
      );
    }
  }

  public getTightBoundingBox(sprite: Sprite | Stage): Rectangle {
    return this._getDrawable(sprite).getTightBoundingBox();
  }

  public getBoundingBox(sprite: Sprite | Stage): Rectangle {
    return Rectangle.fromMatrix(this._getDrawable(sprite).getMatrix());
  }

  // Mask drawing in to only areas where this sprite is opaque.
  private _stencilSprite(spr: Sprite | Stage, colorMask?: Color): void {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

    // Enable stenciling. This means that:
    // 1. Only pixels which pass the "stencil test" will be drawn.
    // 2. Anything rendered will also draw to the stencil buffer.
    gl.enable(gl.STENCIL_TEST);
    // Pass the stencil test regardless of what's in the stencil buffer.
    // Note that pixels which the shader has discarded will still fail the stencil test.
    // 1 is the reference value which we use in the next line.
    gl.stencilFunc(gl.ALWAYS, 1, 1);
    // If the stencil test passes (in this case, if the shader hasn't discarded the pixel),
    // draw a 1 to that pixel in the stencil buffer, replacing whatever's already there.
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    // Don't draw to the color buffer. Only to the stencil buffer.
    gl.colorMask(false, false, false, false);
    // Draw the sprite in the "silhouette" mode, which discards transparent pixels.
    // This, along with the above line, has the effect of not drawing anything to the color buffer, but
    // creating a "mask" in the stencil buffer that masks out all pixels where this sprite is transparent.

    const opts: {
      drawMode: DrawMode;
      renderSpeechBubbles: boolean;
      effectMask: number;
      colorMask?: RGBANormalized;
    } & RenderSpriteOptions = {
      drawMode: ShaderManager.DrawModes.SILHOUETTE,
      renderSpeechBubbles: false,
      // Ignore ghost effect
      effectMask: ~effectBitmasks.ghost,
    };

    // If we mask in the color (for e.g. "color is touching color"),
    // we need to pass that in as a uniform as well.
    if (colorMask) {
      opts.colorMask = colorMask.toRGBANormalized();
      opts.drawMode = ShaderManager.DrawModes.COLOR_MASK;
    }
    this._renderLayers(new Set([spr]), opts);

    // Pass the stencil test if the stencil buffer value equals 1 (e.g. the pixel got masked in above).
    gl.stencilFunc(gl.EQUAL, 1, 1);
    // Keep the current stencil buffer values no matter what.
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    // We can draw to the color buffer again. Note that only pixels which pass the stencil test are drawn.
    gl.colorMask(true, true, true, true);
  }

  public checkSpriteCollision(
    spr: Sprite | Stage,
    targets: Set<Sprite | Stage> | (Sprite | Stage)[] | Sprite | Stage,
    fast?: boolean,
    sprColor?: Color
  ): boolean {
    if ("visible" in spr && !spr.visible) return false;
    if (!(targets instanceof Set)) {
      if (targets instanceof Array) {
        targets = new Set(targets);
      } else {
        targets = new Set([targets]);
      }
    }

    const sprBox = Rectangle.copy(
      this.getBoundingBox(spr),
      __collisionBox
    ).snapToInt();

    // This is an "impossible rectangle"-- its left bound is infinitely far to the right,
    // its right bound is infinitely to the left, and so on. Its size is effectively -Infinity.
    // Its only purpose is to be the "identity rectangle" that starts the rectangle union process.
    const targetBox = Rectangle.fromBounds(
      Infinity,
      -Infinity,
      Infinity,
      -Infinity
    );
    for (const target of targets) {
      Rectangle.union(targetBox, this.getBoundingBox(target), targetBox);
    }
    targetBox.snapToInt();

    if (!sprBox.intersects(targetBox)) return false;
    if (fast) return true;

    const cx = this._collisionBuffer.width / 2;
    const cy = this._collisionBuffer.height / 2;
    const collisionBox = Rectangle.intersection(sprBox, targetBox).clamp(
      -cx,
      cx,
      -cy,
      cy
    );

    if (collisionBox.width === 0 || collisionBox.height === 0) return false;

    this._setFramebuffer(this._collisionBuffer);
    // Enable stencil testing then stencil in this sprite, which masks all further drawing to this sprite's area.
    this._stencilSprite(spr, sprColor);

    // Render the sprites to check that we're touching, which will now be masked in to the area of the first sprite.
    this._renderLayers(targets, {
      drawMode: ShaderManager.DrawModes.SILHOUETTE,
      // Ignore ghost effect
      effectMask: ~effectBitmasks.ghost,
    });

    const gl = this.gl;
    // Make sure to disable the stencil test so as not to affect other rendering!
    gl.disable(gl.STENCIL_TEST);

    const pixelData = new Uint8Array(
      collisionBox.width * collisionBox.height * 4
    );
    gl.readPixels(
      collisionBox.left + cx,
      collisionBox.bottom + cy,
      collisionBox.width,
      collisionBox.height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixelData
    );

    // Any opaque pixel = an overlap between the two sprites.
    for (let i = 0; i < pixelData.length; i += 4) {
      if (pixelData[i + 3] !== 0) return true;
    }

    return false;
  }

  public checkColorCollision(
    spr: Sprite | Stage,
    targetsColor: Color,
    sprColor?: Color
  ): boolean {
    const sprBox = Rectangle.copy(
      this.getBoundingBox(spr),
      __collisionBox
    ).snapToInt();

    const cx = this._collisionBuffer.width / 2;
    const cy = this._collisionBuffer.height / 2;
    sprBox.clamp(-cx, cx, -cy, cy);

    if (sprBox.width === 0 || sprBox.height === 0) return false;

    this._setFramebuffer(this._collisionBuffer);
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

    this._setFramebuffer(this._collisionBuffer);
    // Enable stencil testing then stencil in this sprite, which masks all further drawing to this sprite's area.
    this._stencilSprite(spr, sprColor);

    // Render the sprites to check that we're touching, which will now be masked in to the area of the first sprite.
    this._renderLayers(undefined, undefined, (layer) => layer !== spr);

    // Make sure to disable the stencil test so as not to affect other rendering!
    gl.disable(gl.STENCIL_TEST);

    const pixelData = new Uint8Array(sprBox.width * sprBox.height * 4);
    gl.readPixels(
      sprBox.left + cx,
      sprBox.bottom + cy,
      sprBox.width,
      sprBox.height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixelData
    );

    const color = targetsColor.toRGBA();
    for (let i = 0; i < pixelData.length; i += 4) {
      if (
        // Ensure we're not testing transparent pixels
        pixelData[i + 3] !== 0 &&
        // Scratch tests the top 5 bits of the red and green channels,
        // and the top 4 bits of the blue channel.
        ((pixelData[i] ^ color[0]) & 0b11111000) === 0 &&
        ((pixelData[i + 1] ^ color[1]) & 0b11111000) === 0 &&
        ((pixelData[i + 2] ^ color[2]) & 0b11110000) === 0
      )
        return true;
    }

    return false;
  }

  // Pick the topmost sprite at the given point (if one exists).
  public pick<T extends Sprite | Stage>(
    sprites: T[],
    point: { x: number; y: number }
  ): T | null {
    this._setFramebuffer(this._collisionBuffer);
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const spriteIndices = new Map<Sprite | Stage, number>();
    for (let i = 0; i < sprites.length; i++) {
      spriteIndices.set(sprites[i], i);
    }

    this._renderLayers(new Set(sprites), {
      effectMask: ~effectBitmasks.ghost,
      drawMode: ShaderManager.DrawModes.SPRITE_ID,
      // let's not use indexOf here--that would be O(n^2)
      spriteColorId: (target) => spriteIndices.get(target)!,
    });

    const hoveredPixel = new Uint8Array(4);
    const cx = this._collisionBuffer.width / 2;
    const cy = this._collisionBuffer.height / 2;
    gl.readPixels(
      point.x + cx,
      point.y + cy,
      1,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      hoveredPixel
    );

    const index = colorToId(hoveredPixel);
    if (index === -1) return null;
    return sprites[index];
  }

  public checkPointCollision(
    spr: Sprite | Stage,
    point: { x: number; y: number },
    fast?: boolean
  ): boolean {
    if ("visible" in spr && !spr.visible) return false;

    const box = this.getBoundingBox(spr);
    if (!box.containsPoint(point.x, point.y)) return false;
    if (fast) return true;

    // TODO: would it be faster to enable a scissor rectangle?
    this._setFramebuffer(this._collisionBuffer);
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this._renderLayers(new Set([spr]), { effectMask: ~effectBitmasks.ghost });

    const hoveredPixel = new Uint8Array(4);
    const cx = this._collisionBuffer.width / 2;
    const cy = this._collisionBuffer.height / 2;
    gl.readPixels(
      point.x + cx,
      point.y + cy,
      1,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      hoveredPixel
    );
    return hoveredPixel[3] !== 0;
  }

  public penLine(
    pt1: { x: number; y: number },
    pt2: { x: number; y: number },
    color: Color,
    size: number
  ): void {
    this._penSkin.penLine(pt1, pt2, color, size);
  }

  public clearPen(): void {
    this._penSkin.clear();
  }

  public stamp(spr: Sprite | Stage): void {
    this._setFramebuffer(this._penSkin._framebufferInfo);
    this._renderLayers(new Set([spr]), { renderSpeechBubbles: false });
  }

  public displayAskBox(question: string): Promise<string> {
    if (!this.renderTarget) return Promise.resolve("");
    const askBox = document.createElement("form");
    askBox.classList.add("leopard__askBox");

    const askText = document.createElement("span");
    askText.classList.add("leopard__askText");
    askText.innerText = question;
    askBox.append(askText);

    const askInput = document.createElement("input");
    askInput.type = "text";
    askInput.classList.add("leopard__askInput");
    askBox.append(askInput);

    const askButton = document.createElement("button");
    askButton.classList.add("leopard__askButton");
    askButton.innerText = "Answer";
    askBox.append(askButton);

    this.renderTarget.append(askBox);
    askInput.focus();

    return new Promise((resolve) => {
      askBox.addEventListener("submit", (e) => {
        e.preventDefault();
        askBox.remove();
        resolve(askInput.value);
      });
    });
  }
}
