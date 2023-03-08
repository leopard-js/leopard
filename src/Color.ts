const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));

// https://www.rapidtables.com/convert/color/rgb-to-hsv.html
function rgbToHSV(
  r: number,
  g: number,
  b: number
): {
  h: number;
  s: number;
  v: number;
} {
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

  const v = max;

  return {
    h: h * 100,
    s: s * 100,
    v: v * 100,
  };
}

// https://www.rapidtables.com/convert/color/hsv-to-rgb.html
function hsvToRGB(
  h: number,
  s: number,
  v: number
): { r: number; g: number; b: number } {
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
    b: b * 255,
  };
}

export default class Color {
  private _h = 0;
  private _s = 0;
  private _v = 0;
  private _a = 1;

  public constructor(h = 0, s = 0, v = 0, a = 1) {
    this.h = h;
    this.s = s;
    this.v = v;
    this.a = a;
  }

  public static rgb(r: number, g: number, b: number, a = 1): Color {
    const { h, s, v } = rgbToHSV(r, g, b);
    return new Color(h, s, v, a);
  }

  public static hsv(h: number, s: number, v: number, a = 1): Color {
    return new Color(h, s, v, a);
  }

  public static num(n: number | string): Color {
    n = Number(n);

    // Match Scratch rgba system
    // https://github.com/LLK/scratch-vm/blob/0dffc65ce99307d048f6b9a10b1c31b01ab0133d/src/util/color.js#L45
    const a = (n >> 24) & 0xff;
    const r = (n >> 16) & 0xff;
    const g = (n >> 8) & 0xff;
    const b = n & 0xff;
    return Color.rgb(r, g, b, a > 0 ? a / 255 : 1);
  }

  // Red
  public get r(): number {
    return hsvToRGB(this.h, this.s, this.v).r;
  }
  public set r(r) {
    this._setRGB(r, this.g, this.b);
  }

  // Green
  public get g(): number {
    return hsvToRGB(this.h, this.s, this.v).g;
  }
  public set g(g) {
    this._setRGB(this.r, g, this.b);
  }

  // Blue
  public get b(): number {
    return hsvToRGB(this.h, this.s, this.v).b;
  }
  public set b(b) {
    this._setRGB(this.r, this.g, b);
  }

  // Alpha
  public get a(): number {
    return this._a;
  }
  public set a(a) {
    this._a = clamp(a, 0, 1);
  }

  // Hue
  public get h(): number {
    return this._h;
  }
  public set h(h) {
    this._h = ((h % 100) + 100) % 100;
  }

  // Shade
  public get s(): number {
    return this._s;
  }
  public set s(s) {
    this._s = clamp(s, 0, 100);
  }

  // Value
  public get v(): number {
    return this._v;
  }
  public set v(v) {
    this._v = clamp(v, 0, 100);
  }

  private _setRGB(r: number, g: number, b: number): void {
    r = clamp(r, 0, 255);
    g = clamp(g, 0, 255);
    b = clamp(b, 0, 255);

    const { h, s, v } = rgbToHSV(r, g, b);

    this.h = h;
    this.s = s;
    this.v = v;
  }

  public toHexString(forceIncludeAlpha = false): string {
    const toHexDigits = (n: number): string => {
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

  public toRGBString(forceIncludeAlpha = false): string {
    const rgb = [this.r, this.g, this.b].map(Math.round);

    if (forceIncludeAlpha || this.a !== 1) {
      return `rgba(${rgb.join(", ")}, ${this.a})`;
    }
    return `rgb(${rgb.join(", ")})`;
  }

  public toRGBA(): [number, number, number, number] {
    const rgb = hsvToRGB(this._h, this._s, this._v);
    return [rgb.r, rgb.g, rgb.b, this._a * 255];
  }

  public toRGBANormalized(): [number, number, number, number] {
    const rgb = hsvToRGB(this._h, this._s, this._v);
    return [rgb.r / 255, rgb.g / 255, rgb.b / 255, this._a];
  }

  public toString(): string {
    return this.toRGBString();
  }
}
