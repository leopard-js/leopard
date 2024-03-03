// This file exists to specify a mapping from numeric indices to effect names in all places that require it.
const effectNames = [
  "color",
  "fisheye",
  "whirl",
  "pixelate",
  "mosaic",
  "brightness",
  "ghost",
] as const;

const effectBitmasks = {
  color: 1,
  fisheye: 2,
  whirl: 4,
  pixelate: 8,
  mosaic: 16,
  brightness: 32,
  ghost: 64,
} as const;

export { effectNames, effectBitmasks };
