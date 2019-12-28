import Skin from "./Skin.mjs";

const bubbleStyle = {
  maxLineWidth: 170,
  minWidth: 50,
  strokeWidth: 4,
  padding: 12,
  tailHeight: 12
}

// TODO: multiline speech bubbles
export default class SpeechBubbleSkin extends Skin {
  constructor(renderer, bubble) {
    super(renderer);

    this._canvas = document.createElement("canvas");
    this._texture = null;
    this._bubble = bubble;

    this.width = 0;
    this.height = 0;
    this.offsetX = -bubbleStyle.strokeWidth / 2;
    this.offsetY = this.offsetX + bubbleStyle.tailHeight;
  }

  // To ensure proper text measurement and drawing, it's necessary to restyle the canvas after resizing it.
  _restyleCanvas() {
    const ctx = this._canvas.getContext('2d');
    ctx.font = '16px sans-serif';
    ctx.textBaseline = 'hanging';
  }

  _renderBubble(bubble) {
    const canvas = this._canvas;
    const ctx = canvas.getContext("2d");

    const renderBubbleBackground = (x, y, w, h, r, style) => {
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
      ctx.stroke();
      ctx.fill();

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
        ctx.stroke();
        ctx.fill();
      }
    };

    this._restyleCanvas();

    const { text, style } = bubble;
    const textWidth = ctx.measureText(text).width;

    const maxWidth = bubbleStyle.maxLineWidth;
    const padding = bubbleStyle.padding;

    const width = Math.ceil(Math.min(textWidth, maxWidth) + (2 * padding));
    const height = 10 + 2 * padding;

    this.width = canvas.width = width + bubbleStyle.strokeWidth;
    this.height = canvas.height = height + bubbleStyle.tailHeight + bubbleStyle.strokeWidth;

    this._restyleCanvas();

    const x = bubbleStyle.strokeWidth / 2;
    const y = x;

    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = bubbleStyle.strokeWidth;
    renderBubbleBackground(x, y, width, height, bubbleStyle.tailHeight, style);

    ctx.fillStyle = "#444";
    ctx.fillText(text, x + padding, y + padding, maxWidth);
  }

  getTexture(scale) {
    if (this._texture === null) {
      this._renderBubble(this._bubble);
      this._texture = this._makeTexture(this._canvas, this.gl.LINEAR);
    }

    return this._texture;
  }

  destroy() {
    this.gl.deleteTexture(this._texture);
  }
}