class Texture {
  constructor (image, glTexture) {
    this.image = image;
    this.glTexture = glTexture;
    this.used = true;
  }
}

export default class TextureCache {
  constructor(renderer) {
    this.renderer = renderer;
    this.gl = renderer.gl;

    // TODO: maintain list of unused textures and just retexture those?
    this._costumeTextures = new Map();
  }

  // Begin GC tracing. Any texture fetched during tracing will *not* be garbage-collected.
  beginTrace() {
    // Initialize by assuming no texture is used.
    for (const [key, texture] of this._costumeTextures) {
      texture.used = false;
    }
  }

  // End GC tracing. Any texture not fetched since the tracing began will be deleted.
  endTrace() {
    for (const [key, texture] of this._costumeTextures) {
      if (!texture.used && texture.glTexture) {
        this.gl.deleteTexture(texture.glTexture);
        this._costumeTextures.delete(key);
      }
    }
  }

  // Retrieve a GL texture for a given image. If it doesn't exist, make one.
  getTexture(image) {
    if (!image.complete) return null;
    if (this._costumeTextures.has(image)) {
      const texture = this._costumeTextures.get(image);
      texture.used = true;
      return texture.glTexture;
    } else {
      const gl = this.gl;
      const glTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, glTexture);
      // These need to be set because most sprite textures don't have power-of-two dimensions.
      // Non-power-of-two textures only work with gl.CLAMP_TO_EDGE wrapping behavior,
      // and because they don't support mipmaps, can only use non-mipmap texture filtering.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
      );

      const texture = new Texture(image, glTexture);
      this._costumeTextures.set(image, texture);
      return glTexture;
    }
  }
}