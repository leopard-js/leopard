import Sound from "./Sound.js";

const IGNORABLE_ERROR = ["NotAllowedError", "NotFoundError"];

// https://github.com/LLK/scratch-audio/blob/develop/src/Loudness.js
export default class LoudnessHandler {
  constructor() {
    this.hasConnected = false;
  }

  get audioContext() {
    return Sound.audioContext;
  }

  async connect() {
    if (this.hasConnected) return;
    return navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(stream => {
        this.hasConnected = true;
        this.audioStream = stream;
        const mic = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        mic.connect(this.analyser);
        this.micDataArray = new Float32Array(this.analyser.fftSize);
      })
      .catch(e => {
        if (IGNORABLE_ERROR.includes(e.name)) {
          console.warn("Mic is not available.");
        } else {
          throw e;
        }
      });
  }

  get loudness() {
    if (!this.hasConnected || !this.audioStream.active) return -1;

    this.analyser.getFloatTimeDomainData(this.micDataArray);
    let sum = 0;
    // compute the RMS of the sound
    for (let i = 0; i < this.micDataArray.length; i++) {
      sum += Math.pow(this.micDataArray[i], 2);
    }
    let rms = Math.sqrt(sum / this.micDataArray.length);
    // smoothe the value with the last one, if it is descending
    if (this._lastValue) {
      rms = Math.max(rms, this._lastValue * 0.6);
    }
    this._lastValue = rms;

    // scale the measurement so it's more sensitive to quieter sounds
    rms *= 1.63;
    rms = Math.sqrt(rms);
    rms = Math.round(rms * 100);
    rms = Math.min(rms, 100);
    return rms;
  }

  getLoudness() {
    this.connect();
    return this.loudness;
  }
}
