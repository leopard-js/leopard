import type { Stage } from "./Sprite.js";

type Mouse = { x: number; y: number; down: boolean };

export default class Input {
  _stage: Stage;
  _canvas: HTMLCanvasElement;
  _onKeyDown: (key: string) => unknown;

  mouse: Mouse;
  keys: string[];
  constructor(
    stage: Input["_stage"],
    canvas: Input["_canvas"],
    onKeyDown: Input["_onKeyDown"]
  ) {
    this._stage = stage;
    this._canvas = canvas;

    // Allow setting focus to canvas
    if (this._canvas.tabIndex < 0) {
      this._canvas.tabIndex = 0;
    }

    this.mouse = { x: 0, y: 0, down: false };
    this._canvas.addEventListener("mousemove", this._mouseMove.bind(this));
    this._canvas.addEventListener("mousedown", this._mouseDown.bind(this));
    this._canvas.addEventListener("mouseup", this._mouseUp.bind(this));

    this._canvas.addEventListener("keyup", this._keyup.bind(this));
    this._canvas.addEventListener("keydown", this._keydown.bind(this));

    this.keys = [];
    this._onKeyDown = onKeyDown;
  }

  _mouseMove(e: MouseEvent): void {
    const rect = this._canvas.getBoundingClientRect();
    const scaleX = this._stage.width / rect.width;
    const scaleY = this._stage.height / rect.height;
    const realCoords = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };

    this.mouse = {
      ...this.mouse,
      x: realCoords.x - this._stage.width / 2,
      y: -realCoords.y + this._stage.height / 2,
    };
  }

  _mouseDown(): void {
    this.mouse = {
      ...this.mouse,
      down: true,
    };
  }

  _mouseUp(): void {
    this.mouse = {
      ...this.mouse,
      down: false,
    };
  }

  _keyup(e: KeyboardEvent): void {
    const key = this._getKeyName(e);
    this.keys = this.keys.filter((k) => k !== key);
  }

  _keydown(e: KeyboardEvent): void {
    e.preventDefault();

    const key = this._getKeyName(e);
    if (this.keys.indexOf(key) === -1) {
      this.keys.push(key);
    }

    this._onKeyDown(key);
  }

  _getKeyName(e: KeyboardEvent): string {
    if (e.key === "ArrowUp") return "up arrow";
    if (e.key === "ArrowDown") return "down arrow";
    if (e.key === "ArrowLeft") return "left arrow";
    if (e.key === "ArrowRight") return "right arrow";
    if (e.key === " ") return "space";
    if (e.code.substring(0, 5) === "Digit") return e.code[5];

    return e.key.toLowerCase();
  }

  keyPressed(name: string): boolean {
    if (name === "any") return this.keys.length > 0;
    return this.keys.indexOf(name) > -1;
  }

  focus(): void {
    this._canvas.focus();
  }
}

export type { Mouse };
