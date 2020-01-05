export default class Rectangle {
  constructor() {
    this.left = -Infinity;
    this.right = Infinity;
    this.bottom = -Infinity;
    this.top = Infinity;

    return this;
  }

  static fromBounds(left, right, bottom, top, result) {
    if (!result) result = new Rectangle();
    result.left = left;
    result.right = right;
    result.bottom = bottom;
    result.top = top;

    return result;
  }

  // Initialize a bounding box around a sprite given the sprite's transform matrix.
  static fromMatrix(matrix, result) {
    if (!result) result = new Rectangle();

    // Adapted somewhat from https://github.com/LLK/scratch-render/blob/develop/docs/Rectangle-AABB-Matrix.md
    const xa = matrix[0] / 2;
    const xb = matrix[3] / 2;
    const absx = Math.abs(xa) + Math.abs(xb);
    const sumx = xa + xb + matrix[6];

    const ya = matrix[1] / 2;
    const yb = matrix[4] / 2;
    const absy = Math.abs(ya) + Math.abs(yb);
    const sumy = ya + yb + matrix[7];

    result.left = sumx - absx;
    result.right = sumx + absx;
    result.bottom = sumy - absy;
    result.top = sumy + absy;

    return result;
  }

  // Push this rectangle out to integer bounds.
  // This takes a conservative approach and will always expand the rectangle outwards.
  snapToInt() {
    this.left = Math.floor(this.left);
    this.right = Math.ceil(this.right);
    this.bottom = Math.floor(this.bottom);
    this.top = Math.ceil(this.top);

    return this;
  }

  // Check whether any part of this rectangle touches another rectangle.
  intersects(rect) {
    return (
      this.left <= rect.right &&
      rect.left <= this.right &&
      this.top >= rect.bottom &&
      rect.top >= this.bottom
    );
  }

  // Check whether a given point is inside this rectangle.
  containsPoint(x, y) {
    return (
      x >= this.left && x <= this.right && y >= this.bottom && y <= this.top
    );
  }

  // Clamp this rectangle within bounds.
  clamp(left, right, bottom, top) {
    this.left = Math.min(Math.max(this.left, left), right);
    this.right = Math.max(Math.min(this.right, right), left);
    this.bottom = Math.min(Math.max(this.bottom, bottom), top);
    this.top = Math.max(Math.min(this.top, top), bottom);

    return this;
  }

  // Compute the union of two rectangles.
  static union(rect1, rect2, result = new Rectangle()) {
    result.left = Math.min(rect1.left, rect2.left);
    result.right = Math.max(rect1.right, rect2.right);
    result.bottom = Math.min(rect1.bottom, rect2.bottom);
    result.top = Math.max(rect1.top, rect2.top);

    return result;
  }

  // Compute the intersection of two rectangles.
  static intersection(rect1, rect2, result = new Rectangle()) {
    result.left = Math.max(rect1.left, rect2.left);
    result.right = Math.min(rect1.right, rect2.right);
    result.bottom = Math.max(rect1.bottom, rect2.bottom);
    result.top = Math.min(rect1.top, rect2.top);

    return result;
  }

  get width() {
    return this.right - this.left;
  }

  get height() {
    return this.top - this.bottom;
  }
}
