import Matrix from "./renderer/Matrix.mjs";
import PenSkin from "./renderer/PenSkin.mjs";
import Rectangle from "./renderer/Rectangle.mjs";
import ShaderManager from "./renderer/ShaderManager.mjs";
import SkinCache from "./renderer/SkinCache.mjs";

import {Sprite} from "./Sprite.mjs";

export default class Renderer {
  constructor(renderTarget, { w = 480, h = 360 } = {}) {
    this.stage = this.createStage(w, h);
    this.gl = this.stage.getContext("webgl", {antialias: false});

    if (renderTarget !== undefined) {
      this.setRenderTarget(renderTarget);
    } else {
      this.renderTarget = null;
    }

    this._shaderManager = new ShaderManager(this);
    this._skinCache = new SkinCache(this);

    this._currentShader = null;
    this._currentFramebuffer = null;

    // Initialize a bunch of WebGL state
    const gl = this.gl;

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
      new Float32Array([
        0, 0,
        0, 1,
        1, 0,

        1, 1,
        0, 1,
        1, 0
      ]),
      gl.STATIC_DRAW
    );

    // Set the active texture unit to 0.
    gl.activeTexture(gl.TEXTURE0);

    this._penSkin = new PenSkin(this, w, h);

    // This framebuffer is where sprites are drawn for e.g. "touching" checks.
    this._collisionBuffer = this._createFramebuffer(w, h, gl.NEAREST).framebuffer;

    // In addition to the color attachment, we must also attach a stencil buffer to our collision buffer.
    // The depth buffer is unnecessary, but WebGL only guarantees
    // that certain combinations of framebuffer attachments will work, and "stencil but no depth" is not among them.
    const renderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);
  }

  _createFramebuffer (width, height, filtering) {
    // Create an empty texture with this skin's dimensions.
    const gl = this.gl;
    const texture = gl.createTexture();
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

    // Create a framebuffer backed by said texture. This means we can draw onto the framebuffer,
    // and the results appear in the texture.
    const framebuffer = gl.createFramebuffer();
    this._setFramebuffer(framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    return {texture, framebuffer};
  }

  setRenderTarget(renderTarget) {
    if (typeof renderTarget === "string") {
      renderTarget = document.querySelector(renderTarget);
    }
    this.renderTarget = renderTarget;
    this.renderTarget.classList.add("scratch-js__project");
    this.renderTarget.style.width = `${this.stage.width}px`;
    this.renderTarget.style.height = `${this.stage.height}px`;

    this.renderTarget.append(this.stage);
  }

  _setShader(shader) {
    if (shader !== this._currentShader) {
      const gl = this.gl;
      gl.useProgram(shader.program);

      // These attributes and uniforms don't ever change, but must be set whenever a new shader program is used.

      const attribLocation = shader.attrib('a_position');
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

      // Projection matrix-- transforms from stage dimensions (-240 to 240 and -180 to 180) to GL clip space (-1 to 1).
      gl.uniformMatrix3fv(shader.uniform('u_projection'), false, [
        2 / this.stage.width,
        0,
        0,
        0,
        2 / this.stage.height,
        0,
        0,
        0,
        1
      ]);

      this._currentShader = shader;
    }
  }

  _setFramebuffer(framebuffer) {
    if (framebuffer !== this._currentFramebuffer) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
      this._currentFramebuffer = framebuffer;
    }
  }

  update(stage, sprites) {
    const gl = this.gl;

    // Draw to the screen, not to a framebuffer.
    this._setFramebuffer(null);

    // Clear to opaque white.
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const penMatrix = Matrix.create();
    Matrix.scale(penMatrix, penMatrix, this._penSkin.width, -this._penSkin.height);
    Matrix.translate(penMatrix, penMatrix, -0.5, -0.5);
    this._renderSkin(this._penSkin, ShaderManager.DrawModes.DEFAULT, penMatrix, 1);

    // TODO: find a way to not destroy the skins of hidden sprites
    this._skinCache.beginTrace();

    this.renderSprite(stage);

    for (const sprite of Object.values(sprites)) {
      if (sprite.visible) {
        this.renderSprite(sprite);
        if (sprite._speechBubble.text) {
          this.renderSpriteSpeechBubble(sprite);
        }
      }
    }

    this._skinCache.endTrace();
  }

  createStage(w, h) {
    const stage = document.createElement("canvas");
    stage.width = w;
    stage.height = h;

    return stage;
  }

  _renderSkin(skin, drawMode, matrix, screenSpaceScale, effects) {
    const gl = this.gl;

    let effectBitmask = 0;
    if (effects) effectBitmask = effects._bitmask;
    const shader = this._shaderManager.getShader(drawMode, effectBitmask);
    this._setShader(shader);
    gl.uniformMatrix3fv(shader.uniform('u_transform'), false, matrix);

    if (effectBitmask !== 0) {
      for (const effect of Object.keys(effects._effectValues)) {
        const effectVal = effects._effectValues[effect];
        if (effectVal !== 0) gl.uniform1f(shader.uniform(`u_${effect}`), effectVal);
      }

      // Pixelate effect needs the skin size
      if (effects._effectValues.pixelate !== 0) gl.uniform2f(shader.uniform("u_skinSize"), skin.width, skin.height);
    }

    const skinTexture = skin.getTexture(screenSpaceScale);

    gl.bindTexture(gl.TEXTURE_2D, skinTexture);
    // All textures are bound to texture unit 0, so that's where the texture sampler should point
    gl.uniform1i(shader.uniform('u_texture'), 0);

    // Draw 6 vertices. In this case, they belong to the 2 triangles that make up 1 quadrilateral.
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  renderSprite(spr, drawMode = ShaderManager.DrawModes.DEFAULT) {
    // The stage does not have a size, so set its scale to 1.
    let spriteScale = 1;
    if (spr.size) {
      spriteScale = spr.size / 100;
    }

    // These transforms are actually in reverse order because lol matrices
    const m = Matrix.create();
    Matrix.translate(m, m, spr.x, spr.y);
    switch (spr.rotationStyle) {
      case Sprite.RotationStyle.ALL_AROUND: {
        Matrix.rotate(m, m, spr.scratchToRad(spr.direction));
        break;
      }
      case Sprite.RotationStyle.LEFT_RIGHT: {
        if (spr.direction < 0) Matrix.scale(m, m, -1, 1);
        break;
      }
    }

    Matrix.scale(m, m, spriteScale, spriteScale);
    Matrix.translate(m, m, -spr.costume.center.x, -spr.costume.center.y);
    Matrix.scale(m, m, spr.costume.width, spr.costume.height);

    const gl = this.gl;

    const spriteSkin = this._skinCache.getSkin(spr.costume);
    this._renderSkin(spriteSkin, drawMode, m, spriteScale, spr.effects);
  }

  renderSpriteSpeechBubble(spr) {
    const speechBubbleSkin = this._skinCache.getSkin(spr._speechBubble);

    const box = this.getBoundingBox(spr);
    const x = Math.round(box.right - speechBubbleSkin.offsetX);
    const y = Math.round(box.top - speechBubbleSkin.offsetY);

    const m = Matrix.create();
    Matrix.translate(m, m, x, y);
    Matrix.scale(m, m, speechBubbleSkin.width, speechBubbleSkin.height);

    this._renderSkin(speechBubbleSkin, ShaderManager.DrawModes.DEFAULT, m, 1);
  }

  getBoundingBox(sprite) {
    const origin = {
      x: sprite.x,
      y: sprite.y
    };

    const s = sprite.size / 100;
    const dist = {
      left: s * sprite.costume.center.x,
      right: s * (sprite.costume.width - sprite.costume.center.x),
      up: s * sprite.costume.center.y,
      down: s * (sprite.costume.height - sprite.costume.center.y)
    };

    const spriteDirRad = sprite.scratchToRad(sprite.direction);
    const angle = {
      left: spriteDirRad + Math.PI,
      right: spriteDirRad,
      up: spriteDirRad - Math.PI / 2,
      down: spriteDirRad + Math.PI / 2
    };

    const movePoint = (pt, angle, dist) => ({
      x: pt.x + Math.cos(angle) * dist,
      y: pt.y + Math.sin(angle) * dist
    });

    const points = [
      movePoint(movePoint(origin, angle.up, dist.up), angle.right, dist.right),
      movePoint(movePoint(origin, angle.up, dist.up), angle.left, dist.left),
      movePoint(movePoint(origin, angle.down, dist.down), angle.right, dist.right),
      movePoint(movePoint(origin, angle.down, dist.down), angle.left, dist.left)
    ];

    const rect = new Rectangle();

    rect.left = Math.min.apply(
      Math,
      points.map(pt => pt.x)
    );
    rect.right = Math.max.apply(
      Math,
      points.map(pt => pt.x)
    );
    rect.bottom = Math.min.apply(
      Math,
      points.map(pt => pt.y)
    );
    rect.top = Math.max.apply(
      Math,
      points.map(pt => pt.y)
    );

    return rect;
  }

  checkSpriteCollision(spr1, spr2, fast) {
    if (!spr1.visible) return false;
    if (!spr2.visible) return false;

    const box1 = this.getBoundingBox(spr1).snapToInt();
    const box2 = this.getBoundingBox(spr2).snapToInt();

    if (!box1.intersects(box2)) return false;
    if (fast) return true;

    const collisionBox = Rectangle.intersection(box1, box2).clamp(-240, 240, -180, 180);

    this._setFramebuffer(this._collisionBuffer);
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
    this.renderSprite(spr1, ShaderManager.DrawModes.SILHOUETTE);

    // Pass the stencil test if the stencil buffer value equals 1 (e.g. the pixel got masked in above).
    gl.stencilFunc(gl.EQUAL, 1, 1);
    // Keep the current stencil buffer values no matter what.
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    // We can draw to the color buffer again. Note that only pixels which pass the stencil test are drawn.
    gl.colorMask(true, true, true, true);
    // Render the second sprite, which will now be masked in to the area of the first sprite.
    this.renderSprite(spr2, ShaderManager.DrawModes.SILHOUETTE);

    // Make sure to disable the stencil test so as not to affect other rendering!
    gl.disable(gl.STENCIL_TEST);

    const pixelData = new Uint8Array(collisionBox.width * collisionBox.height * 4);
    gl.readPixels(
      collisionBox.left + 240,
      collisionBox.bottom + 180,
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

  checkPointCollision(spr, point, fast) {
    if (!spr.visible) return false;

    const box = this.getBoundingBox(spr);
    if (!box.containsPoint(point.x, point.y)) return false;
    if (fast) return true;

    // TODO: would it be faster to enable a scissor rectangle?
    this._setFramebuffer(this._collisionBuffer);
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.renderSprite(spr);

    const hoveredPixel = new Uint8Array(4);
    gl.readPixels(point.x + 240, point.y + 180, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, hoveredPixel);
    return hoveredPixel[3] !== 0;
  }

  penLine(pt1, pt2, color, size) {
    this._penSkin.penLine(pt1, pt2, color, size);
  }

  clearPen() {
    this._penSkin.clear();
  }

  stamp(sprite) {
    this._setFramebuffer(this._penSkin._framebuffer);
    this.renderSprite(sprite);
  }

  displayAskBox(question) {
    const askBox = document.createElement("form");
    askBox.classList.add("scratch-js__askBox");

    const askText = document.createElement("span");
    askText.classList.add("scratch-js__askText");
    askText.innerText = question;
    askBox.append(askText);

    const askInput = document.createElement("input");
    askInput.type = "text";
    askInput.classList.add("scratch-js__askInput");
    askBox.append(askInput);

    const askButton = document.createElement("button");
    askButton.classList.add("scratch-js__askButton");
    askButton.innerText = "Answer";
    askBox.append(askButton);

    this.renderTarget.append(askBox);
    askInput.focus();

    return new Promise(resolve => {
      askBox.addEventListener("submit", e => {
        e.preventDefault();
        askBox.remove();
        resolve(askInput.value);
      });
    });
  }
}
