/* Adapted from gl-matrix
 * https://github.com/toji/gl-matrix
 */

// 3x3 transform matrix operations, unrolled 4 da speedz.
export default class Matrix {
  // Create a new 3x3 transform matrix, initialized to the identity matrix.
  static create() {
    const matrix = new Float32Array(9);
    Matrix.identity(matrix);
    return matrix;
  }

  // Reset a matrix to the identity matrix
  static identity(dst: MatrixType) {
    dst[0] = 1;
    dst[1] = 0;
    dst[2] = 0;
    dst[3] = 0;
    dst[4] = 1;
    dst[5] = 0;
    dst[6] = 0;
    dst[7] = 0;
    dst[8] = 1;
    return dst;
  }

  // Translate a matrix by the given X and Y values
  static translate(dst: MatrixType, src: MatrixType, x: number, y: number) {
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
  static rotate(dst: MatrixType, src: MatrixType, rad: number) {
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
  static scale(dst: MatrixType, src: MatrixType, x: number, y: number) {
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

  // Transform a 2D point by the given matrix
  static transformPoint(
    m: MatrixType,
    dst: [number, number],
    src: [number, number]
  ) {
    const x = src[0];
    const y = src[1];
    dst[0] = m[0] * x + m[3] * y + m[6];
    dst[1] = m[1] * x + m[4] * y + m[7];
    return dst;
  }
}

export type MatrixType = Float32Array;
