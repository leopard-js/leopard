export default class Skin {
  constructor (renderer) {
    this.renderer = renderer;
    this.gl = renderer.gl;
    this.used = true;
  }

  // Get the skin's texture for a given (screen-space) scale.
  // This is a method and not a getter to signal that it's potentially expensive.
  getTexture (scale) {
    return null;
  }

  // Clean up any textures or other objets created by this skin.
  destroy () {}
}