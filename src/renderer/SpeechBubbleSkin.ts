import Skin from "./Skin";
import type Renderer from "../Renderer";
import type { SpeechBubble, SpeechBubbleStyle } from "../Sprite";

const bubbleStyle = {
  maxLineWidth: 170,
  minWidth: 50,
  strokeWidth: 4,
  padding: 12,
  tailHeight: 12,
} as const;

// TODO: multiline speech bubbles
export default class SpeechBubbleSkin extends Skin {
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;
  private _texture: WebGLTexture | null;
  private _bubble: SpeechBubble;
  private _flipped: boolean;
  private _rendered: boolean;
  private _renderedScale: number;
  public offsetX: number;
  public offsetY: number;

  public constructor(renderer: Renderer, bubble: SpeechBubble) {
    super(renderer);

    this._canvas = document.createElement("canvas");
    const ctx = this._canvas.getContext("2d");
    if (ctx === null) throw new Error("Could not get canvas context");
    this._ctx = ctx;
    this._texture = this._makeTexture(null, this.gl.LINEAR);
    this._bubble = bubble;
    this._flipped = false;
    this._rendered = false;
    this._renderedScale = 0;

    this.width = 0;
    this.height = 0;
    this.offsetX = -bubbleStyle.strokeWidth / 2;
    this.offsetY = this.offsetX + bubbleStyle.tailHeight;
  }

  // To ensure proper text measurement and drawing, it's necessary to restyle the canvas after resizing it.
  private _restyleCanvas(): void {
    const ctx = this._ctx;
    ctx.font = "16px sans-serif";
    ctx.textBaseline = "hanging";
  }

  public get flipped(): boolean {
    return this._flipped;
  }

  public set flipped(flipped) {
    this._flipped = flipped;
    this._rendered = false;
  }

  private _renderBubble(bubble: SpeechBubble, scale: number): void {
    const canvas = this._canvas;
    const ctx = this._ctx;

    const renderBubbleBackground = (
      x: number,
      y: number,
      w: number,
      h: number,
      r: number,
      style: SpeechBubbleStyle
    ): void => {
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
      } else {
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

    const width = Math.ceil(Math.min(textWidth, maxWidth) + 2 * padding);
    const height = 10 + 2 * padding;

    this.width = width + bubbleStyle.strokeWidth;
    this.height = height + bubbleStyle.tailHeight + bubbleStyle.strokeWidth;

    canvas.width = this.width * scale;
    canvas.height = this.height * scale;

    this._restyleCanvas();

    const x = bubbleStyle.strokeWidth / 2;
    const y = x;

    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = bubbleStyle.strokeWidth;
    ctx.save();
    if (this._flipped) {
      ctx.scale(-1, 1);
      ctx.translate(-this.width, 0);
    }
    renderBubbleBackground(x, y, width, height, bubbleStyle.tailHeight, style);
    ctx.restore();

    ctx.fillStyle = "#444";
    ctx.fillText(text, x + padding, y + padding, maxWidth);

    this._rendered = true;
    this._renderedScale = scale;
  }

  public getTexture(scale: number): WebGLTexture | null {
    if (!this._rendered || this._renderedScale !== scale) {
      this._renderBubble(this._bubble, scale);
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this._texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this._canvas
      );
    }

    return this._texture;
  }

  public getImageData(scale: number): ImageData | null {
    this.getTexture(scale);
    return this._ctx.getImageData(
      0,
      0,
      this._canvas.width,
      this._canvas.height
    );
  }

  public destroy(): void {
    this.gl.deleteTexture(this._texture);
  }
}
