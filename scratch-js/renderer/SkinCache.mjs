import BitmapSkin from "./BitmapSkin.mjs";
import VectorSkin from "./VectorSkin.mjs";

// This is a class which manages the creation and destruction of Skin objects.
// A Skin is the renderer's version of a "costume". It is backed by an image, but you render it by getting its texture.
// Different types of Skins can give you textures in different ways.
export default class SkinCache {
  constructor(renderer) {
    this._renderer = renderer;
    this.gl = renderer.gl;

    this._costumeSkins = new Map();
  }

  // Begin GC tracing. Any skin retrieved and rendered during tracing will *not* be garbage-collected.
  beginTrace() {
    // Initialize by assuming no texture is used.
    for (const [key, skin] of this._costumeSkins) {
      skin.used = false;
    }
  }

  // End GC tracing. Any skin not retrieved since the tracing begun will be deleted.
  endTrace() {
    for (const [key, skin] of this._costumeSkins) {
      if (!skin.used) {
        skin.destroy();
        this._costumeSkins.delete(key);
      }
    }
  }

  // Retrieve a given costume's skin. If it doesn't exist, make one.
  getSkin(costume) {
    if (this._costumeSkins.has(costume)) {
      const skin = this._costumeSkins.get(costume);
      skin.used = true;
      return skin;
    } else {
      let skin;

      // TODO: there's gotta be a better way to tell if an image is an SVG
      if (costume.img.src.endsWith('.svg')) {
        skin = new VectorSkin(this._renderer, costume.img);
      } else {
        skin = new BitmapSkin(this._renderer, costume.img);
      }
      this._costumeSkins.set(costume, skin);
      return skin;
    }
  }
}