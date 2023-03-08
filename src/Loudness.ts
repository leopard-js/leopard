import Sound from "./Sound";

const IGNORABLE_ERROR = ["NotAllowedError", "NotFoundError"];

const enum ConnectionState {
  /** We have not tried connecting yet. */
  NOT_CONNECTED,
  /** We are in the middle of connecting. */
  CONNECTING,
  /** We connected successfully. */
  CONNECTED,
  /** There was an error connecting. */
  ERROR,
}

// https://github.com/LLK/scratch-audio/blob/develop/src/Loudness.js
export default class LoudnessHandler {
  connectionState: ConnectionState;
  audioStream: MediaStream | undefined;
  analyser: AnalyserNode | undefined;
  micDataArray: Float32Array | undefined;
  _lastValue: number | undefined;

  constructor() {
    // TODO: use a TypeScript enum
    this.connectionState = ConnectionState.NOT_CONNECTED;
  }

  get audioContext(): AudioContext {
    return Sound.audioContext;
  }

  async connect(): Promise<void> {
    // If we're in the middle of connecting, or failed to connect,
    // don't attempt to connect again
    if (this.connectionState !== ConnectionState.NOT_CONNECTED) return;
    this.connectionState = ConnectionState.CONNECTING;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Chrome blocks usage of audio until the user interacts with the page.
      // By calling `resume` here, we will wait until that happens.
      await Sound.audioContext.resume();
      this.audioStream = stream;
      const mic = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      mic.connect(this.analyser);
      this.micDataArray = new Float32Array(this.analyser.fftSize);
      this.connectionState = ConnectionState.CONNECTED;
    } catch (e) {
      this.connectionState = ConnectionState.ERROR;
      if (IGNORABLE_ERROR.includes((e as Error).name)) {
        console.warn("Mic is not available.");
      } else {
        throw e;
      }
    }
  }

  get loudness(): number {
    if (
      this.connectionState !== ConnectionState.CONNECTED ||
      !this.audioStream?.active ||
      !this.analyser ||
      !this.micDataArray
    ) {
      return -1;
    }

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

  getLoudness(): number {
    void this.connect();
    return this.loudness;
  }
}
