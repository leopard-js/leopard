import Matrix from "./renderer/Matrix.mjs";
import ShaderManager from "./renderer/ShaderManager.mjs";
import TextureCache from "./renderer/TextureCache.mjs";

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
    this._textureCache = new TextureCache(this);

    this._currentShader = null;

    // Initialize a bunch of WebGL state
    const gl = this.gl;

    // Use premultiplied alpha for proper color blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

    // Initialize vertex buffer. This will draw one 2D quadrilateral.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

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

  update(stage, sprites) {
    const gl = this.gl;
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.renderSprite(stage, this.ctx);

    this._textureCache.beginTrace();

    for (const sprite of Object.values(sprites)) {
      if (sprite.visible) {
        this.renderSprite(sprite, this.ctx);
        if (sprite._speechBubble.text) {
          //this.renderSpriteSpeechBubble(sprite, this.ctx);
        }
      }
    }

    this._textureCache.endTrace();
  }

  createStage(w, h) {
    // TODO: create WebGL framebuffer
    const stage = document.createElement("canvas");
    stage.width = w;
    stage.height = h;

    return stage;
  }

  renderSprite(spr, ctx) {
    const gl = this.gl;
    const shader = this._shaderManager.getShader(ShaderManager.DrawModes.SPRITE);
    if (shader !== this._currentShader) {
      gl.useProgram(shader.program);

      // These attributes and uniforms don't ever change, but must be set whenever a new shader program is used.

      const attribLocation = shader.attrib('a_position');
      gl.enableVertexAttribArray(attribLocation);
      // Bind the 'a_position' vertex attribute to the current contents of `gl.ARRAY_BUFFER`, which in this case
      // is a quadrilateral (as buffered earlier).
      gl.vertexAttribPointer(
        attribLocation,
        2, // vec2
        gl.FLOAT,
        false,
        0,
        0
      );

      // Projection matrix-- transforms from stage dimensions to GL clip space (-1 to 1).
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

    const m = Matrix.create();

    // These transforms are actually in reverse order because lol matrices
    Matrix.translate(m, m, spr.x, spr.y);
    Matrix.rotate(m, m, spr.scratchToRad(spr.direction));
    Matrix.scale(m, m, spr.size / 100, spr.size / 100);
    Matrix.translate(m, m, -spr.costume.center.x, -spr.costume.center.y);
    Matrix.scale(m, m, spr.costume.width, spr.costume.height);

    gl.uniformMatrix3fv(shader.uniform('u_transform'), false, m);

    const spriteTexture = this._textureCache.getTexture(spr.costume.img);

    gl.bindTexture(gl.TEXTURE_2D, spriteTexture);
    // All textures are bound to texture unit 0, so that's where the texture sampler should point
    gl.uniform1i(shader.uniform('u_texture'), 0);

    // Draw 6 vertices. In this case, they belong to the 2 triangles that make up 1 quadrilateral.
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  renderSpriteSpeechBubble(spr, ctx) {
    const renderBubble = (x, y, w, h, r, style) => {
      if (r > w / 2) r = w / 2;
      if (r > h / 2) r = h / 2;
      if (r < 0) return;

      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x + r, y + h, r);
      if (style === "say") {
        ctx.lineTo(Math.min(x + 3 * r, x + w - r), y + h);
        ctx.lineTo(x + r / 2, y + h + r);
        ctx.lineTo(x + r, y + h);
      } else if (style === "think") {
        ctx.ellipse(x + r * 2.25, y + h, (r * 3) / 4, r / 2, 0, 0, Math.PI);
      }
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (style === "think") {
        ctx.beginPath();
        ctx.ellipse(
          x + r,
          y + h + (r * 3) / 4,
          r / 3,
          r / 3,
          0,
          0,
          2 * Math.PI
        );
        ctx.fill();
        ctx.stroke();
      }
    };

    const box = this.getBoundingBox(spr);

    ctx.font = "16px sans-serif";
    ctx.textBaseline = "hanging";

    const { text, style } = spr._speechBubble;
    let { width } = ctx.measureText(text);

    const maxWidth = this.stage.width - box.right;
    const padding = 12;

    width = Math.min(width + 2 * padding, maxWidth);
    const height = 10 + 2 * padding;
    const x = box.right;
    const y = box.top - height;

    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 2;
    renderBubble(x, y, width, height, 12, style);

    ctx.fillStyle = "#444";
    ctx.fillText(text, x + padding, y + padding, maxWidth - 2 * padding);
  }

  getBoundingBox(sprite) {
    const origin = {
      x: sprite.x + 240,
      y: -sprite.y + 180
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
      movePoint(
        movePoint(origin, angle.down, dist.down),
        angle.right,
        dist.right
      ),
      movePoint(movePoint(origin, angle.down, dist.down), angle.left, dist.left)
    ];

    return {
      left: Math.round(
        Math.min.apply(
          Math,
          points.map(pt => pt.x)
        )
      ),
      right: Math.round(
        Math.max.apply(
          Math,
          points.map(pt => pt.x)
        )
      ),
      top: Math.round(
        Math.min.apply(
          Math,
          points.map(pt => pt.y)
        )
      ),
      bottom: Math.round(
        Math.max.apply(
          Math,
          points.map(pt => pt.y)
        )
      )
    };
  }

  checkSpriteCollision(spr1, spr2, fast) {
    if (!spr1.visible) return false;
    if (!spr2.visible) return false;

    const box1 = this.getBoundingBox(spr1);
    const box2 = this.getBoundingBox(spr2);

    if (box1.right <= box2.left) return false;
    if (box1.left >= box2.right) return false;
    if (box1.bottom <= box2.top) return false;
    if (box1.top >= box2.bottom) return false;

    if (fast) return true;

    const left = Math.max(box1.left, box2.left);
    const right = Math.min(box1.right, box2.right);
    const top = Math.max(box1.top, box2.top);
    const bottom = Math.min(box1.bottom, box2.bottom);

    const collisionStage = this.createStage(right - left, bottom - top);
    const collisionCtx = collisionStage.getContext("2d");

    collisionCtx.setTransform(1, 0, 0, 1, 0, 0);
    collisionCtx.translate(-left, -top);

    collisionCtx.globalCompositeOperation = "source-over";
    this.renderSprite(spr1, collisionCtx);

    collisionCtx.globalCompositeOperation = "source-in";
    this.renderSprite(spr2, collisionCtx);

    // If collision stage contains any alpha > 0, there's a collision
    const w = collisionStage.width;
    const h = collisionStage.height;
    const imgData = collisionCtx.getImageData(0, 0, w, h).data;

    const length = w * h * 4;
    for (let i = 0; i < length; i += 4) {
      if (imgData[i + 3] > 0) {
        return true;
      }
    }

    return false;
  }

  checkPointCollision(spr, point, fast) {
    if (!spr.visible) return false;

    const box = this.getBoundingBox(spr);

    if (box.right < point.x) return false;
    if (box.left > point.x) return false;
    if (box.top > point.y) return false;
    if (box.bottom < point.y) return false;

    if (fast) return true;

    const collisionStage = this.createStage(
      box.right - box.left,
      box.bottom - box.top
    );
    const collisionCtx = collisionStage.getContext("2d");

    collisionCtx.setTransform(1, 0, 0, 1, 0, 0);
    collisionCtx.translate(-box.left, -box.top);

    this.renderSprite(spr, collisionCtx);

    const w = collisionStage.width;
    const h = collisionStage.height;
    const imgData = collisionCtx.getImageData(0, 0, w, h).data;

    // Check if point has alpha > 0
    const x = point.x - box.left;
    const y = point.y - box.top;
    return imgData[(y * w + x) * 4 + 3] > 0;
  }

  penLine(pt1, pt2, color, size) {
    this.penLayer.lineWidth = size;
    this.penLayer.strokeStyle = color;
    this.penLayer.lineCap = "round";

    this.penLayer.beginPath();
    this.penLayer.moveTo(pt1.x + 240, 180 - pt1.y);
    this.penLayer.lineTo(pt2.x + 240, 180 - pt2.y);
    this.penLayer.stroke();
  }

  clearPen() {
    this.penLayer.clearRect(0, 0, this.penStage.width, this.penStage.height);
  }

  stamp(sprite) {
    this.renderSprite(sprite, this.penLayer);
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
