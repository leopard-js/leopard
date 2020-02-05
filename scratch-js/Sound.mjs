import decodeADPCMAudio, { isADPCMData } from "./lib/decode-adpcm-audio.mjs";

export default class Sound {
  constructor(name, url) {
    this.name = name;
    this.url = url;

    this.audioBuffer = null;
    this.node = null;
    this.source = null;

    // TODO: Remove this line; initiate downloads from somewhere else instead.
    this.downloadMyAudioBuffer();
  }

  get duration() {
    return this.audioBuffer.duration;
  }

  *start() {
    let started = false;
    let isLatestCallToStart = true;

    if (this._markDone) {
      this._markDone();
    }

    if (this.audioBuffer) {
      this.playMyAudioBuffer();
      started = true;
    } else {
      // It's possible that start() will be called again before this start() has
      // successfully started the sound (i.e. because it was waiting for the
      // audio buffer to download). If that's the case, _doneDownloading will
      // already exist. We never want to return from start() before the sound has
      // begun playing, but in the case of playUntilDone(), only the latest call
      // should wait for the sound to finish playing; also, we only need to run
      // playMyAudioBuffer once. To meet all these conditions, and also to avoid
      // implementing some kind of addEventListener-esque system, we implement
      // a simple "listener chain" here. Every time we set call start(), we keep
      // track of the previous value of doneDownloading, and replace it with a new
      // function. When this function is called directly as a result of the download
      // finishing, it will call, if existent, the previous value of doneDownloading
      // with a flag indicating it is being called from a more recent call to
      // start(). That function will in turn do the same for its saved previous
      // value, and so on, until all the previous values of doneDownloading have
      // been called. Thus, all previous calls of start() will then finish,
      // returning their value of isLatestCallToStart: false, indicating that if the
      // call came from playUntilDone(), that playUntilDone should not wait for the
      // sound to finish playing. Of course, the latest call returns true, and so
      // the containing playUntilDone() (if present) knows to wait.
      const oldDoneDownloading = this._doneDownloading;
      this._doneDownloading = fromMoreRecentCall => {
        if (fromMoreRecentCall) {
          isLatestCallToStart = false;
        } else {
          this.playMyAudioBuffer();
          started = true;
          delete this._doneDownloading;
        }
        if (oldDoneDownloading) {
          oldDoneDownloading(true);
        }
      };
    }

    while (!started && isLatestCallToStart) yield;

    return isLatestCallToStart;
  }

  *playUntilDone() {
    let playing = true;

    const isLatestCallToStart = yield* this.start();

    // If we failed to download the audio buffer, just stop here - the sound will
    // never play, so it doesn't make sense to wait for it.
    if (!this.audioBuffer) {
      return;
    }

    this.source.addEventListener("ended", () => {
      playing = false;
      delete this._markDone;
    });

    // If there was another call to start() since ours, don't wait for the
    // sound to finish before returning.
    if (!isLatestCallToStart) {
      return;
    }

    // Set _markDone after calling start(), because start() will call the existing
    // value of _markDone if it's already set. It does this because playUntilDone()
    // is meant to be interrupted if another start() is ran while it's playing.
    // Of course, we don't want *this* playUntilDone() to be treated as though it
    // were interrupted when we call start(), so setting _markDone comes after.
    this._markDone = () => {
      playing = false;
      delete this._markDone;
    };

    while (playing) yield;
  }

  stop() {
    if (this._markDone) {
      this._markDone();
    }

    if (this.node) {
      this.node.disconnect();
      this.node = null;
    }
  }

  downloadMyAudioBuffer() {
    Sound.setupAudioContext();
    return fetch(this.url)
      .then(body => body.arrayBuffer())
      .then(arrayBuffer => {
        if (isADPCMData(arrayBuffer)) {
          return decodeADPCMAudio(arrayBuffer, Sound.audioContext).catch(
            error => {
              console.warn(
                `Failed to load sound "${this.name}" - will not play:\n` + error
              );
              return null;
            }
          );
        } else {
          return new Promise((resolve, reject) => {
            Sound.audioContext.decodeAudioData(arrayBuffer, resolve, reject);
          });
        }
      })
      .then(audioBuffer => {
        this.audioBuffer = audioBuffer;
        if (this._doneDownloading) {
          this._doneDownloading();
        }
        return audioBuffer;
      });
  }

  playMyAudioBuffer() {
    if (!this.audioBuffer) {
      return;
    }

    Sound.setupAudioContext();

    if (!this.node) {
      this.node = Sound.audioContext.createGain();
      this.node.connect(Sound.audioContext.destination);
    }

    if (this.source) {
      this.source.disconnect();
    }
    this.source = Sound.audioContext.createBufferSource();
    this.source.buffer = this.audioBuffer;
    this.source.connect(this.node);

    this.source.start(Sound.audioContext.currentTime);
  }

  static setupAudioContext() {
    // note: this === the Sound class here!
    if (!this.audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
    }
  }

  static decodeADPCMAudio(audioBuffer) {
    this.setupAudioContext();
    return decodeADPCMAudio(audioBuffer, this.audioContext);
  }
}
