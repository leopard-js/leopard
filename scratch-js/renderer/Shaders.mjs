const SpriteShader = {};

SpriteShader.vertex =
`
precision mediump float;

attribute vec2 a_position;
uniform mat3 u_projection;
uniform mat3 u_transform;

varying vec2 v_texCoord;

void main() {
  v_texCoord = vec2(a_position.x, 1.0 - a_position.y);
  gl_Position = vec4(u_projection * u_transform * vec3(a_position, 1.0), 1.0);
}
`;

SpriteShader.fragment =
`
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

#if defined(EFFECT_whirl) || defined(EFFECT_fisheye)
const vec2 CENTER = vec2(0.5, 0.5);
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

PenLineShader.vertex =
`
precision mediump float;

attribute vec2 a_position;
uniform vec4 u_penPoints;
uniform vec2 u_penSkinSize;
uniform float u_penSize;

varying vec2 v_texCoord;

void main() {
  float penRadius = u_penSize * 0.5;
  vec2 topRight = floor(min(u_penPoints.xy, u_penPoints.zw) - penRadius);
  vec2 bottomLeft = ceil(max(u_penPoints.xy, u_penPoints.zw) + penRadius);
  vec2 penBounds = a_position * (bottomLeft - topRight) + topRight;

  vec2 position = (penBounds / u_penSkinSize) * 2.0;
  v_texCoord = penBounds;
  gl_Position = vec4(position, 1.0, 1.0);
}
`

PenLineShader.fragment =
`
precision mediump float;

uniform sampler2D u_texture;
uniform vec4 u_penPoints;
uniform vec4 u_penColor;
uniform float u_penSize;
varying vec2 v_texCoord;

void main() {
  // Maaaaagic antialiased-line-with-round-caps shader.
	// Adapted from Inigo Quilez' 2D distance function cheat sheet
	// https://www.iquilezles.org/www/articles/distfunctions2d/distfunctions2d.htm
	vec2 pa = v_texCoord - u_penPoints.xy, ba = u_penPoints.zw - u_penPoints.xy;
	float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);

	float cappedLine = clamp((u_penSize + 1.0) * 0.5 - length(pa - ba*h), 0.0, 1.0);

	gl_FragColor = u_penColor * cappedLine;
}
`

export {SpriteShader, PenLineShader};