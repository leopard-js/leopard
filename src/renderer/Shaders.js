const SpriteShader = {};

SpriteShader.vertex = `
precision mediump float;

attribute vec2 a_position;
uniform mat3 u_transform;
uniform vec2 u_stageSize;

varying vec2 v_texCoord;

void main() {
  v_texCoord = vec2(a_position.x, 1.0 - a_position.y);
  gl_Position = vec4((u_transform * vec3(a_position, 1.0)) / vec3(u_stageSize * 0.5, 1.0), 1.0);
}
`;

SpriteShader.fragment = `
precision mediump float;

const float epsilon = 1e-3;

uniform sampler2D u_texture;
varying vec2 v_texCoord;

#ifdef EFFECT_color
uniform float u_color;
#endif

#ifdef EFFECT_fisheye
uniform float u_fisheye;
#endif

#ifdef EFFECT_whirl
uniform float u_whirl;
#endif

#ifdef EFFECT_pixelate
uniform float u_pixelate;
uniform vec2 u_skinSize;
#endif

#ifdef EFFECT_mosaic
uniform float u_mosaic;
#endif

#ifdef EFFECT_brightness
uniform float u_brightness;
#endif

#ifdef EFFECT_ghost
uniform float u_ghost;
#endif

#if defined(EFFECT_whirl) || defined(EFFECT_fisheye) || defined(EFFECT_pixelate)
const vec2 CENTER = vec2(0.5, 0.5);
#endif

#ifdef DRAW_MODE_COLOR_MASK
uniform vec4 u_colorMask;

// TODO: Scratch 2.0 and Scratch 3.0's CPU path check if the top 6 bits match,
// which a tolerance of 3/255 should be equivalent to,
// but Scratch's GPU path has a tolerance of 2/255.
const vec3 COLOR_MASK_TOLERANCE = vec3(3.0 / 255.0);
#endif

#ifdef EFFECT_color
// Taken from http://lolengine.net/blog/2013/07/27/rgb-to-hsv-in-glsl
vec3 rgb2hsv(vec3 c)
{
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = c.g < c.b ? vec4(c.bg, K.wz) : vec4(c.gb, K.xy);
  vec4 q = c.r < p.x ? vec4(p.xyw, c.r) : vec4(c.r, p.yzx);

  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c)
{
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
#endif

void main() {
  vec2 coord = v_texCoord;

  #ifdef EFFECT_mosaic
  {
    float mosaicFactor = clamp(floor(abs(u_mosaic + 10.0) / 10.0 + 0.5), 1.0, 512.0);
    coord = fract(coord * mosaicFactor);
  }
  #endif

  #ifdef EFFECT_pixelate
    vec2 pixSize = u_skinSize / (abs(u_pixelate) * 0.1);
    coord = (floor(coord * pixSize) + CENTER) / pixSize;
  #endif

  #ifdef EFFECT_whirl
  {
    const float PI_OVER_180 = 0.017453292519943295;
    vec2 offset = coord - CENTER;
    float whirlFactor = max(1.0 - (length(offset) * 2.0), 0.0);
    float whirl = (-u_whirl * PI_OVER_180) * whirlFactor * whirlFactor;
    float s = sin(whirl);
    float c = cos(whirl);
    mat2 rotationMatrix = mat2(c, -s, s, c);
    coord = rotationMatrix * offset + CENTER;
  }
  #endif

  #ifdef EFFECT_fisheye
  {
    vec2 vec = (coord - CENTER) / CENTER;
    float len = length(vec) + epsilon;
    float factor = max(0.0, (u_fisheye + 100.0) / 100.0);
    float r = pow(min(len, 1.0), factor) * max(1.0, len);
    vec2 unit = vec / len;
    coord = CENTER + (r * unit * CENTER);
  }
  #endif

  vec4 color = texture2D(u_texture, coord);

  #if defined(EFFECT_color) || defined(EFFECT_brightness)
  // Un-premultiply color values by alpha channel
  vec3 unmul = color.rgb / color.a;

  #ifdef EFFECT_color
  {
    vec3 hsv = rgb2hsv(unmul);
    const float minLightness = 0.11 / 2.0;
    const float minSaturation = 0.09;

    hsv.z = max(minLightness, hsv.z);
    hsv.y = max(minSaturation, hsv.y);

    hsv.x = mod(hsv.x + (u_color / 200.0), 1.0);

    unmul = hsv2rgb(hsv);
  }
  #endif

  #ifdef EFFECT_brightness
  {
    unmul = clamp(unmul + clamp(u_brightness * 0.01, -1.0, 1.0), 0.0, 1.0);
  }
  #endif

  color = vec4(unmul * color.a, color.a);

  #endif // defined(defined(EFFECT_color) || defined(EFFECT_brightness))

  #ifdef DRAW_MODE_COLOR_MASK
  vec3 diff = abs(u_colorMask.rgb - color.rgb);
  if (any(greaterThan(diff, COLOR_MASK_TOLERANCE))) {
    discard;
  }
  #endif

  #ifdef EFFECT_ghost
  color *= (1.0 - clamp(u_ghost * 0.01, 0.0, 1.0));
  #endif

  #ifdef DRAW_MODE_SILHOUETTE
  if (color.a == 0.0) {
    discard;
  }
  #endif

  gl_FragColor = color;
}
`;

const PenLineShader = {};

PenLineShader.vertex = `
precision mediump float;

attribute vec2 a_position;
// The X and Y components of u_penPoints hold the first pen point. The Z and W components hold the difference between
// the second pen point and the first. This is done because calculating the difference in the shader leads to floating-
// point error when both points have large-ish coordinates.
uniform vec4 u_penPoints;
uniform vec2 u_penSkinSize;
uniform float u_penSize;
uniform float u_lineLength;

varying vec2 v_texCoord;

// Add this to divisors to prevent division by 0, which results in NaNs propagating through calculations.
// Smaller values can cause problems on some mobile devices.
const float epsilon = 1e-3;

void main() {
  // Calculate a rotated ("tight") bounding box around the two pen points.
  // Yes, we're doing this 6 times (once per vertex), but on actual GPU hardware,
  // it's still faster than doing it in JS combined with the cost of uniformMatrix4fv.

  // Expand line bounds by sqrt(2) / 2 each side-- this ensures that all antialiased pixels
  // fall within the quad, even at a 45-degree diagonal
  vec2 position = a_position;
  float expandedRadius = (u_penSize * 0.5) + 1.4142135623730951;

  // The X coordinate increases along the length of the line. It's 0 at the center of the origin point
  // and is in pixel-space (so at n pixels along the line, its value is n).
  v_texCoord.x = mix(0.0, u_lineLength + (expandedRadius * 2.0), a_position.x) - expandedRadius;
  // The Y coordinate is perpendicular to the line. It's also in pixel-space.
  v_texCoord.y = ((a_position.y - 0.5) * expandedRadius) + 0.5;

  position.x *= u_lineLength + (2.0 * expandedRadius);
  position.y *= 2.0 * expandedRadius;

  // 1. Center around first pen point
  position -= expandedRadius;

  // 2. Rotate quad to line angle
  vec2 pointDiff = u_penPoints.zw;
  // Ensure line has a nonzero length so it's rendered properly
  // As long as either component is nonzero, the line length will be nonzero
  // If the line is zero-length, give it a bit of horizontal length
  pointDiff.x = (abs(pointDiff.x) < epsilon && abs(pointDiff.y) < epsilon) ? epsilon : pointDiff.x;
  // The 'normalized' vector holds rotational values equivalent to sine/cosine
  // We're applying the standard rotation matrix formula to the position to rotate the quad to the line angle
  // pointDiff can hold large values so we must divide by u_lineLength instead of calling GLSL's normalize function:
  // https://asawicki.info/news_1596_watch_out_for_reduced_precision_normalizelength_in_opengl_es
  vec2 normalized = pointDiff / max(u_lineLength, epsilon);
  position = mat2(normalized.x, normalized.y, -normalized.y, normalized.x) * position;

  // 3. Translate quad
  position += u_penPoints.xy;

  // 4. Apply view transform
  position *= 2.0 / u_penSkinSize;
  gl_Position = vec4(position, 0, 1);
}
`;

PenLineShader.fragment = `
precision mediump float;

uniform sampler2D u_texture;
uniform vec4 u_penPoints;
uniform vec4 u_penColor;
uniform float u_penSize;
uniform float u_lineLength;
varying vec2 v_texCoord;

void main() {
  // Maaaaagic antialiased-line-with-round-caps shader.

	// "along-the-lineness". This increases parallel to the line.
	// It goes from negative before the start point, to 0.5 through the start to the end, then ramps up again
	// past the end point.
	float d = ((v_texCoord.x - clamp(v_texCoord.x, 0.0, u_lineLength)) * 0.5) + 0.5;

	// Distance from (0.5, 0.5) to (d, the perpendicular coordinate). When we're in the middle of the line,
	// d will be 0.5, so the distance will be 0 at points close to the line and will grow at points further from it.
	// For the "caps", d will ramp down/up, giving us rounding.
	// See https://www.youtube.com/watch?v=PMltMdi1Wzg for a rough outline of the technique used to round the lines.
	float line = distance(vec2(0.5), vec2(d, v_texCoord.y)) * 2.0;
	// Expand out the line by its thickness.
	line -= ((u_penSize - 1.0) * 0.5);
	// Because "distance to the center of the line" decreases the closer we get to the line, but we want more opacity
	// the closer we are to the line, invert it.
	gl_FragColor = u_penColor * clamp(1.0 - line, 0.0, 1.0);
}
`;

export { SpriteShader, PenLineShader };
