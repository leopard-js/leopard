import { effectBitmasks } from "./effectInfo.js";
import type Drawable from "./Drawable.js";

const CENTER = 0.5;
const EPSILON = 1e-3;

// Transform a texture-space point using the effects defined on the given drawable.
const effectTransformPoint = (
  drawable: Drawable,
  src: [number, number],
  dst: [number, number]
): [number, number] => {
  const { effects } = drawable._sprite;
  const effectBitmask = effects._bitmask;

  dst[0] = src[0];
  dst[1] = src[1];

  if ((effectBitmask & effectBitmasks.mosaic) !== 0) {
    // float mosaicFactor = clamp(floor(abs(u_mosaic + 10.0) / 10.0 + 0.5), 1.0, 512.0);
    const mosaicFactor = Math.max(
      1,
      Math.min(Math.floor(Math.abs(effects.mosaic + 10) / 10 + 0.5), 512)
    );
    // coord = fract(coord * mosaicFactor);
    dst[0] = (mosaicFactor * dst[0]) % 1;
    dst[1] = (mosaicFactor * dst[1]) % 1;
  }

  if ((effectBitmask & effectBitmasks.pixelate) !== 0) {
    // vec2 pixSize = u_skinSize / (abs(u_pixelate) * 0.1);
    const skin = drawable.getCurrentSkin();
    const pixSizeX = skin.width / (Math.abs(effects.pixelate) * 0.1);
    const pixSizeY = skin.height / (Math.abs(effects.pixelate) * 0.1);
    // coord = (floor(coord * pixSize) + CENTER) / pixSize;
    dst[0] = (Math.floor(dst[0] * pixSizeX) + CENTER) / pixSizeX;
    dst[1] = (Math.floor(dst[1] * pixSizeY) + CENTER) / pixSizeY;
  }

  if ((effectBitmask & effectBitmasks.whirl) !== 0) {
    // const float PI_OVER_180 = 0.017453292519943295;
    const PI_OVER_180 = 0.017453292519943295;
    // vec2 offset = coord - CENTER;
    const offsetX = dst[0] - CENTER;
    const offsetY = dst[1] - CENTER;
    // float whirlFactor = max(1.0 - (length(offset) * 2.0), 0.0);
    const offsetLength = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    const whirlFactor = Math.max(1 - offsetLength * 2, 0);
    // float whirl = (-u_whirl * PI_OVER_180) * whirlFactor * whirlFactor;
    const whirl = -effects.whirl * PI_OVER_180 * whirlFactor * whirlFactor;
    // float s = sin(whirl);
    // float c = cos(whirl);
    const s = Math.sin(whirl);
    const c = Math.cos(whirl);
    // mat2 rotationMatrix = mat2(c, -s, s, c);
    // coord = rotationMatrix * offset + CENTER;
    dst[0] = c * offsetX + s * offsetY + CENTER;
    dst[1] = -s * offsetX + c * offsetY + CENTER;
  }

  if ((effectBitmask & effectBitmasks.fisheye) !== 0) {
    // vec2 vec = (coord - CENTER) / CENTER;
    const vecX = (dst[0] - CENTER) / CENTER;
    const vecY = (dst[1] - CENTER) / CENTER;
    // float len = length(vec) + epsilon;
    const len = Math.sqrt(vecX * vecX + vecY * vecY) + EPSILON;
    // float factor = max(0.0, (u_fisheye + 100.0) / 100.0);
    const factor = Math.max(0, (effects.fisheye + 100) / 100);
    // float r = pow(min(len, 1.0), factor) * max(1.0, len);
    const r = Math.pow(Math.min(len, 1), factor) * Math.max(1, len);
    // vec2 unit = vec / len;
    const unitX = vecX / len;
    const unitY = vecY / len;
    // coord = CENTER + (r * unit * CENTER);
    dst[0] = CENTER + r * unitX * CENTER;
    dst[1] = CENTER + r * unitY * CENTER;
  }

  return dst;
};

export default effectTransformPoint;
