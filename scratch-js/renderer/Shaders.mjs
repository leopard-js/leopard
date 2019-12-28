const Shaders = {};

Shaders.vertex =
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

Shaders.fragment =
`
precision mediump float;

uniform sampler2D u_texture;
varying vec2 v_texCoord;

void main() {
  gl_FragColor = texture2D(u_texture, v_texCoord) * vec4(0.5, 0.5, 0.5, 0.5);
}
`;

export default Shaders;