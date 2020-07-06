// This file exists to specify a mapping from numeric indices to effect names in all places that require it.
const effectNames = [
  "color",
  "fisheye",
  "whirl",
  "pixelate",
  "mosaic",
  "brightness",
  "ghost"
];

const effectBitmasks = {};
for (let i = 0; i < effectNames.length; i++) {
  effectBitmasks[effectNames[i]] = 1 << i;
}

export { effectNames, effectBitmasks };
