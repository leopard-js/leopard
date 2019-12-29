const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// https://www.rapidtables.com/convert/color/rgb-to-hsv.html
function rgbToHSV(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta === 0) {
    // Grey. Leave at 0.
  } else if (max === r) {
    h = (((g - b) / delta + 6) % 6) / 6;
  } else if (max === g) {
    h = (((b - r) / delta + 2) % 6) / 6;
  } else if (max === b) {
    h = (((r - g) / delta + 4) % 6) / 6;
  }

  let s = 0;
  if (max !== 0) {
    s = delta / max;
  }

  let v = max;

  return {
    h: h * 100,
    s: s * 100,
    v: v * 100
  };
}

// https://www.rapidtables.com/convert/color/hsv-to-rgb.html
function hsvToRGB(h, s, v) {
  h = (h / 100) * 360;
  s /= 100;
  v /= 100;

  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));

  const min = v - c;

  let r = min;
  let g = min;
  let b = min;

  if (h < 60) {
    r += c;
    g += x;
  } else if (h < 120) {
    g += c;
    r += x;
  } else if (h < 180) {
    g += c;
    b += x;
  } else if (h < 240) {
    b += c;
    g += x;
  } else if (h < 300) {
    b += c;
    r += x;
  } else if (h < 360) {
    r += c;
    b += x;
  }

  return {
    r: r * 255,
    g: g * 255,
    b: b * 255
  };
}

export default class Color {
  constructor(r = 0, g = 0, b = 0, a = 1) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }

  static rgb(r, g, b, a = 1) {
    return new Color(r, g, b, a);
  }

  static hsv(h, s, v, a = 1) {
    const { r, g, b } = hsvToRGB(h, s, v);
    return new Color(r, g, b, a);
  }

  // Red
  get r() {
    return this._r;
  }
  set r(r) {
    this._r = clamp(r, 0, 255);
  }

  // Green
  get g() {
    return this._g;
  }
  set g(g) {
    this._g = clamp(g, 0, 255);
  }

  // Blue
  get b() {
    return this._b;
  }
  set b(b) {
    this._b = clamp(b, 0, 255);
  }

  // Alpha
  get a() {
    return this._a;
  }
  set a(a) {
    this._a = clamp(a, 0, 1);
  }

  // Hue
  get h() {
    return rgbToHSV(this.r, this.g, this.b).h;
  }
  set h(h) {
    this._setHSV(h, this.s, this.v);
  }

  // Shade
  get s() {
    return rgbToHSV(this.r, this.g, this.b).s;
  }
  set s(s) {
    this._setHSV(this.h, s, this.v);
  }

  // Value
  get v() {
    return rgbToHSV(this.r, this.g, this.b).v;
  }
  set v(v) {
    this._setHSV(this.h, this.s, v);
  }

  _setHSV(h, s, v) {
    h = ((h % 100) + 100) % 100;
    s = clamp(s, 0, 100);
    v = clamp(v, 0, 100);

    const { r, g, b } = hsvToRGB(h, s, v);

    this.r = r;
    this.g = g;
    this.b = b;
  }

  toHexString(forceIncludeAlpha = false) {
    const toHexDigits = n => {
      n = clamp(Math.round(n), 0, 255);

      let str = n.toString(16);
      if (str.length === 1) {
        str = "0" + str;
      }

      return str;
    };

    let hex = "#" + [this.r, this.g, this.b].map(toHexDigits).join("");
    if (forceIncludeAlpha || this.a !== 1) {
      hex += toHexDigits(this.a * 255);
    }

    return hex;
  }

  toRGBString(forceIncludeAlpha = false) {
    const rgb = [this.r, this.g, this.b].map(Math.round);

    if (forceIncludeAlpha || this.a !== 1) {
      return `rgba(${rgb.join(", ")}, ${this.a})`;
    }
    return `rgb(${rgb.join(", ")})`;
  }

  toString() {
    return this.toRGBString();
  }
}
