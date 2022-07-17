import Matrix from "./Matrix.js";

import { Sprite, Stage } from "../Sprite.js";

// Renderer-specific data for an instance (the original or a clone) of a Sprite
export default class Drawable {
  constructor(renderer, sprite) {
    this._renderer = renderer;
    this._sprite = sprite;

    // Transformation matrix for the sprite.
    this._matrix = Matrix.create();
    this._calculateSpriteMatrix();
  }

  _calculateSpriteMatrix() {
    const m = this._matrix;
    Matrix.identity(m);
    const spr = this._sprite;
    if (!(spr instanceof Stage)) {
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

      const spriteScale = spr.size / 100;
      Matrix.scale(m, m, spriteScale, spriteScale);
    }

    const scalingFactor = 1 / spr.costume.resolution;
    // Rotation centers are in non-Scratch space (positive y-values = down),
    // but these transforms are in Scratch space (negative y-values = down).
    Matrix.translate(
      m,
      m,
      -spr.costume.center.x * scalingFactor,
      (spr.costume.center.y - spr.costume.height) * scalingFactor
    );
    Matrix.scale(
      m,
      m,
      spr.costume.width * scalingFactor,
      spr.costume.height * scalingFactor
    );

    // Store the values we used to compute the matrix so we only recalculate
    // the matrix when we really need to.
    this._matrixX = this._sprite.x;
    this._matrixY = this._sprite.y;
    this._matrixRotation = this._sprite.direction;
    this._matrixRotationStyle = this._sprite.rotationStyle;
    this._matrixScale = this._sprite.scale;
    this._matrixCostume = this._sprite.costume;
    this._matrixCostumeLoaded = this._sprite.costume.img.complete;
  }

  getMatrix() {
    // If all the values we used to calculate the matrix haven't changed since
    // we last calculated the matrix, we can just return the matrix as-is.
    if (
      this._matrixX !== this._sprite.x ||
      this._matrixY !== this._sprite.y ||
      this._matrixRotation !== this._sprite.direction ||
      this._matrixRotationStyle !== this._sprite.rotationStyle ||
      this._matrixScale !== this._sprite.scale ||
      this._matrixCostume !== this._sprite.costume ||
      this._matrixCostumeLoaded !== this._sprite.costume.img.complete
    ) {
      this._calculateSpriteMatrix();
    }

    return this._matrix;
  }
}
