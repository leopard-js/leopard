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

uniform sampler2D u_texture;
varying vec2 v_texCoord;

void main() {
  gl_FragColor = texture2D(u_texture, v_texCoord);
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