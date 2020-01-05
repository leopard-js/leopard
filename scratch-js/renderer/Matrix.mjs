/* Adapted from gl-matrix
 * https://github.com/toji/gl-matrix
 */

// 3x3 transform matrix operations, unrolled 4 da speedz.
export default class Matrix {
  // Create a new 3x3 transform matrix, initialized to the identity matrix.
  static create() {
    const matrix = new Float32Array(9);
    matrix[0] = 1;
    matrix[4] = 1;
    matrix[8] = 1;
    return matrix;
  }

  // Translate a matrix by the given X and Y values
  static translate(dst, src, x, y) {
    const a00 = src[0],
      a01 = src[1],
      a02 = src[2],
      a10 = src[3],
      a11 = src[4],
      a12 = src[5],
      a20 = src[6],
      a21 = src[7],
      a22 = src[8];

    dst[0] = a00;
    dst[1] = a01;
    dst[2] = a02;

    dst[3] = a10;
    dst[4] = a11;
    dst[5] = a12;

    dst[6] = x * a00 + y * a10 + a20;
    dst[7] = x * a01 + y * a11 + a21;
    dst[8] = x * a02 + y * a12 + a22;
    return dst;
  }

  // Rotate a matrix, in radians
  static rotate(dst, src, rad) {
    const a00 = src[0],
      a01 = src[1],
      a02 = src[2],
      a10 = src[3],
      a11 = src[4],
      a12 = src[5],
      a20 = src[6],
      a21 = src[7],
      a22 = src[8],
      s = Math.sin(rad),
      c = Math.cos(rad);

    dst[0] = c * a00 + s * a10;
    dst[1] = c * a01 + s * a11;
    dst[2] = c * a02 + s * a12;

    dst[3] = c * a10 - s * a00;
    dst[4] = c * a11 - s * a01;
    dst[5] = c * a12 - s * a02;

    dst[6] = a20;
    dst[7] = a21;
    dst[8] = a22;
    return dst;
  }

  // Scale a matrix by the given X and Y values
  static scale(dst, src, x, y) {
    dst[0] = x * src[0];
    dst[1] = x * src[1];
    dst[2] = x * src[2];

    dst[3] = y * src[3];
    dst[4] = y * src[4];
    dst[5] = y * src[5];

    dst[6] = src[6];
    dst[7] = src[7];
    dst[8] = src[8];
    return dst;
  }
}
