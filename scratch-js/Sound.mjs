export default class Sound {
  constructor(name, url) {
    this.name = name;
    this.url = url;

    this.audio = new Audio();
    this.audio.crossOrigin = "Anonymous";
    this.audio.src = this.url;
  }

  get duration() {
    return this.audio.duration;
  }

  start() {
    this.audio.currentTime = 0;

    if (this._markDone) {
      this._markDone();
    }

    return this.audio.play();
  }

  *playUntilDone() {
    let playing = true;

    this.audio.addEventListener("ended", () => {
      playing = false;
      delete this._markDone;
    });

    this.start();

    // Set _markDone after calling start(), because if there's any existing value for _markDone, start() will call that
    // (so that the playUntilDone which set it will end).
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

    this.audio.pause();
  }
}
