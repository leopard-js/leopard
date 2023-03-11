import decodeADPCMAudio, { isADPCMData } from "./lib/decode-adpcm-audio";
import type { Yielding } from "./lib/yielding";

export default class Sound {
  public name: string;
  public url: string;

  private audioBuffer: AudioBuffer | null;
  private source: AudioBufferSourceNode | null;
  private playbackRate: number;
  private target: AudioNode | undefined;

  private _markDone: (() => void) | undefined;
  private _doneDownloading: ((fromMoreRecentCall: boolean) => void) | undefined;

  private static _audioContext: AudioContext | undefined;
  public constructor(name: string, url: string) {
    this.name = name;
    this.url = url;

    this.audioBuffer = null;
    this.source = null;
    this.playbackRate = 1;

    // TODO: Remove this line; initiate downloads from somewhere else instead.
    void this.downloadMyAudioBuffer();
  }

  public get duration(): number {
    return this.audioBuffer ? this.audioBuffer.duration : 0;
  }

  public *start(): Yielding<boolean> {
    let started = false;
    let isLatestCallToStart = true;

    if (this._markDone) {
      this._markDone();
    }

    if (this.audioBuffer) {
      this.playMyAudioBuffer();
      started = true;
    } else {
      // It's possible that start() will be called again before this start()
      // has successfully started the sound (i.e. because it was waiting for
      // the audio buffer to download). If that's the case, _doneDownloading
      // will already exist. We never want to return from start() before the
      // sound has begun playing, but in the case of playUntilDone(), only the
      // latest call should wait for the sound to finish playing; also, we only
      // need to run playMyAudioBuffer once. To meet all these conditions, and
      // also to avoid implementing some kind of addEventListener-esque system,
      // we implement a simple "listener chain" here. Every time we set call
      // start(), we keep track of the previous value of doneDownloading, and
      // replace it with a new function. When this function is called directly
      // as a result of the download finishing, it will call, if existent, the
      // previous value of doneDownloading with a flag indicating it is being
      // called from a more recent call to start(). That function will in turn
      // do the same for its saved previous value, and so on, until all the
      // previous values of doneDownloading have been called. Thus, all
      // previous calls of start() will then finish, returning their value of
      // isLatestCallToStart: false, indicating that if the call came from
      // playUntilDone(), that playUntilDone should not wait for the sound to
      // finish playing. Of course, the latest call returns true, and so the
      // containing playUntilDone() (if present) knows to wait.
      const oldDoneDownloading = this._doneDownloading;
      this._doneDownloading = (fromMoreRecentCall): void => {
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

  public *playUntilDone(): Yielding<void> {
    let playing = true;

    const isLatestCallToStart = yield* this.start();

    // If we failed to download the audio buffer, just stop here - the sound will
    // never play, so it doesn't make sense to wait for it.
    if (!this.audioBuffer || !this.source) {
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
    this._markDone = (): void => {
      playing = false;
      delete this._markDone;
    };

    while (playing) yield;
  }

  public stop(): void {
    if (this._markDone) {
      this._markDone();
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
  }

  public downloadMyAudioBuffer(): Promise<AudioBuffer | null> {
    return fetch(this.url)
      .then((body) => body.arrayBuffer())
      .then((arrayBuffer) => {
        if (isADPCMData(arrayBuffer)) {
          return decodeADPCMAudio(arrayBuffer, Sound.audioContext).catch(
            (error: Error) => {
              console.warn(
                `Failed to load sound "${this.name}" - will not play:\n` +
                  error.toString()
              );
              return null;
            }
          );
        } else {
          return new Promise((resolve: DecodeSuccessCallback, reject) => {
            void Sound.audioContext.decodeAudioData(
              arrayBuffer,
              resolve,
              reject
            );
          });
        }
      })
      .then((audioBuffer) => {
        this.audioBuffer = audioBuffer;
        if (this._doneDownloading) {
          this._doneDownloading(false);
        }
        return audioBuffer;
      });
  }

  private playMyAudioBuffer(): void {
    if (!this.audioBuffer) {
      return;
    }

    if (this.source) {
      this.source.disconnect();
    }

    this.source = Sound.audioContext.createBufferSource();
    this.source.buffer = this.audioBuffer;
    this.source.playbackRate.value = this.playbackRate;

    if (this.target) {
      this.source.connect(this.target);
    }

    this.source.start(Sound.audioContext.currentTime);
  }

  public connect(target: AudioNode): void {
    if (target !== this.target) {
      this.target = target;
      if (this.source) {
        this.source.disconnect();
        this.source.connect(this.target);
      }
    }
  }

  public setPlaybackRate(value: number): void {
    this.playbackRate = value;
    if (this.source) {
      this.source.playbackRate.value = value;
    }
  }

  public isConnectedTo(target: AudioNode): boolean {
    return this.target === target;
  }

  // Note: "this" refers to the Sound class in static functions.

  public static get audioContext(): AudioContext {
    if (!this._audioContext) {
      const AudioContext =
        window.AudioContext ||
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        ((window as any).webkitAudioContext as AudioContext);
      this._audioContext = new AudioContext();
    }
    return this._audioContext;
  }
}

// Instead of creating a basic Effect class and then implementing a subclass
// for each effect type, we use a simplified object-descriptor style.
// The makeNodes() function returns an object which is passed on to set(), so
// that effects are able to access a variety of nodes (or other values, if
// necessary) required to execute the desired effect.
//
// The code in makeNodes as well as the general definition for each effect is
// all graciously based on LLK's scratch-audio library.
//
// The initial value of an effect should always be the value at which the
// sound is not affected at all - i.e, it would be the same if the effect
// nodes were completely disconnected from the chain or otherwise had never
// been applied. This allows for clean discarding of effect nodes when returned
// to the initial value.
//
// The order of this array matches AudioEngine's effects list in scratch-audio.
// Earlier in the list is closer to the EffectChain input node; later is closer
// to its target (output). Note that a non-"patch" effect's position in the
// array has no bearing on effect behavior, since it isn't part of the chain
// system.
//
// Note that this descriptor list is fairly easy to build on, if we'd like to
// add more audio effects in the future. (Scratch used to have more, but they
// were removed - see commit ff6cd4a - because they depended on an external
// library and were too processor-intensive to support on some devices.)

type EffectDescriptorBase<Name> = {
  name: Name;
  initial: number;
  minimum?: number;
  maximum?: number;
  resetOnStart?: boolean;
  resetOnClone?: boolean;
};

type PatchlessDescriptor<Name> = {
  isPatch: false;
  set: (value: number, sound: Sound) => void;
} & EffectDescriptorBase<Name>;

type PatchDescriptor<Name, Nodes> = {
  isPatch: true;
  makeNodes: () => Nodes & { input: AudioNode; output: AudioNode };
  set: (
    value: number,
    nodes: Nodes & { input: AudioNode; output: AudioNode }
  ) => void;
} & EffectDescriptorBase<Name>;

type EffectDescriptor<
  isPatch extends boolean,
  Name extends string,
  Nodes extends isPatch extends true ? object : never
> = isPatch extends true
  ? PatchDescriptor<Name, Nodes>
  : PatchlessDescriptor<Name>;

type Effects = {
  [x in EffectName]: number;
};

const PanEffect: EffectDescriptor<
  true,
  "pan",
  { leftGain: GainNode; rightGain: GainNode }
> = {
  name: "pan",
  initial: 0,
  minimum: -100,
  maximum: 100,
  isPatch: true,
  makeNodes() {
    const aCtx = Sound.audioContext;
    const input = aCtx.createGain();
    const leftGain = aCtx.createGain();
    const rightGain = aCtx.createGain();
    const channelMerger = aCtx.createChannelMerger(2);
    const output = channelMerger;
    input.connect(leftGain);
    input.connect(rightGain);
    leftGain.connect(channelMerger, 0, 0);
    rightGain.connect(channelMerger, 0, 1);
    return { input, output, leftGain, rightGain, channelMerger };
  },
  set(value, { leftGain, rightGain }) {
    const p = (value + 100) / 200;
    const leftVal = Math.cos((p * Math.PI) / 2);
    const rightVal = Math.sin((p * Math.PI) / 2);
    const { currentTime } = Sound.audioContext;
    const { decayWait, decayDuration } = EffectChain;
    leftGain.gain.setTargetAtTime(
      leftVal,
      currentTime + decayWait,
      decayDuration
    );
    rightGain.gain.setTargetAtTime(
      rightVal,
      currentTime + decayWait,
      decayDuration
    );
  },
} as const;

const PitchEffect: EffectDescriptor<false, "pitch", never> = {
  name: "pitch",
  initial: 0,
  isPatch: false,
  set(value, sound) {
    const interval = value / 10;
    const ratio = Math.pow(2, interval / 12);
    sound.setPlaybackRate(ratio);
  },
} as const;

const VolumeEffect: EffectDescriptor<true, "volume", { node: GainNode }> = {
  name: "volume",
  initial: 100,
  minimum: 0,
  maximum: 100,
  resetOnStart: false,
  resetOnClone: true,
  isPatch: true,
  makeNodes() {
    const node = Sound.audioContext.createGain();
    return {
      input: node,
      output: node,
      node,
    };
  },
  set(value, { node }) {
    node.gain.linearRampToValueAtTime(
      value / 100,
      Sound.audioContext.currentTime + EffectChain.decayDuration
    );
  },
} as const;

const effectDescriptors = [PanEffect, PitchEffect, VolumeEffect] as const;
type EffectName = typeof effectDescriptors[number]["name"];

type EffectChainConfig = { getNonPatchSoundList: () => Sound[] };

export class EffectChain {
  // The code in this class is functionally comparable to the class of the same
  // name in the scratch-audio library, but is completely rewritten and follows
  // somewhat different logic. Still, the class exists on the same principle:
  // a portable way to store the effect chain, independent of the audio sources
  // it affects.

  public inputNode: AudioNode;
  private getNonPatchSoundList: () => Sound[];
  private effectValues!: Record<EffectName, number>;
  private effectNodes: {
    [T in typeof effectDescriptors[number] as T["name"]]?: ReturnType<
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      T extends PatchDescriptor<string, any> ? T["makeNodes"] : never
    >;
  };
  private target?: AudioNode;

  public constructor(config: EffectChainConfig) {
    const { getNonPatchSoundList } = config;

    this.inputNode = Sound.audioContext.createGain();

    // This is a mapping of an effect's name to an object containing all the
    // nodes which are of use to that effect: always an {input, output} pair,
    // as well as any other nodes of use to that effect. The values here are
    // filled in by an effect descriptor's makeNodes() function, and may
    // contain duplicate copies of the same node within a particular effect's
    // object, when that's of use to make the logic clearer (e.g. when there's
    // no distinction between the input and output node, or referring to the
    // output node by a more specific name).
    this.effectNodes = {};

    this.resetToInitial();

    this.getNonPatchSoundList = getNonPatchSoundList;
  }

  public resetToInitial(): void {
    // Note: some effects won't be reset by this function, except for when they
    // are set for the first time (i.e. when the EffectChain is instantiated).
    // Look for the "reset: false" flag in the effect descriptor list.

    const initials = EffectChain.getInitialEffectValues();
    if (this.effectValues) {
      for (const [name, initialValue] of Object.entries(
        EffectChain.getInitialEffectValues()
      ) as [EffectName, number][]) {
        if (EffectChain.getEffectDescriptor(name).resetOnStart !== false) {
          this.setEffectValue(name, initialValue);
        }
      }
    } else {
      this.effectValues = initials;
    }
  }

  private updateAudioEffect(name: EffectName): void {
    const descriptor = EffectChain.getEffectDescriptor(name);

    if (!descriptor) {
      return;
    }

    // updateAudioEffect doesn't take a value - it only reflects the existing
    // value in the actual effects applied to nodes and sounds!
    const value = this.effectValues[name];

    if (descriptor.isPatch) {
      // Here, we search for the next and previous effects in the chain
      // who have existent nodes. This means we'll skip non-patch effects as
      // well as effects are set to their initial value.

      let nextDescriptor: EffectDescriptorBase<EffectName> = descriptor;
      do {
        nextDescriptor = EffectChain.getNextEffectDescriptor(
          nextDescriptor.name
        )!;
      } while (nextDescriptor && !this.effectNodes[nextDescriptor.name]);

      let previousDescriptor: EffectDescriptorBase<EffectName> = descriptor;
      do {
        previousDescriptor = EffectChain.getPreviousEffectDescriptor(
          previousDescriptor.name
        )!;
      } while (
        previousDescriptor &&
        !this.effectNodes[previousDescriptor.name]
      );

      // If we have previous and next values available, they'll currently be
      // the corresponding descriptors. But we only ever need to access the
      // nodes which correspond to those descriptor's names, so we replace them
      // with the actual objects containing the effect's nodes here to simplify
      // later code.

      let next;
      if (nextDescriptor) {
        next = this.effectNodes[nextDescriptor.name];
      }

      let previous;
      if (previousDescriptor) {
        previous = this.effectNodes[previousDescriptor.name];
      }

      // If there is no preceding or following effect which has existent nodes,
      // we'll make the variables reference the target input and target nodes
      // of the EffectChain - i.e, the two ends of the chain, as far as this
      // class is concerned. (Note that while the input node will always be
      // present, because it's defined right on the EffectChain, it's possible
      // that there won't be any target node, leaving the value for "next"
      // still null.)
      //
      // We do need to keep to the structure that effectNodes contains, though.
      // When we access the previous node (or the EffectChain's input node, in
      // this case), we'll be making a connection with its output; likewise,
      // when we're accessing the next node (or the EffectChain's target),
      // we'll be connecting something to its input. That's reflected in the
      // values here.

      if (!previous) {
        previous = { output: this.inputNode };
      }

      if (!next && this.target) {
        next = { input: this.target };
      }

      // "Patch" effects are applied by sending audio data through an ordered
      // series - i.e, a chain - of WebAudio nodes. All effects have an input
      // node and an output node; for simple effects, these may actually be the
      // same node. (Take a look at the volume effect, which uses a single Gain
      // node as both its input and output.) Other effects are more complex.
      // The code in this block controls the actual chaining behavior of
      // EffectChain, assuring that all effects form a clean chain.
      let nodes = this.effectNodes[descriptor.name]!;
      if (!nodes && value !== descriptor.initial) {
        nodes = descriptor.makeNodes();
        // The "as any" cast is needed because TypeScript can't infer that the
        // descriptor's name determines the type of its nodes
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        this.effectNodes[descriptor.name] = nodes as any;

        // Connect the previous effect, or, if there is none, the EffectChain
        // input, to this effect. Also disconnect it from whatever it was
        // previously connected to, so we aren't sending data more than one
        // place at a time - that would mess with the chain.
        previous.output.disconnect();
        previous.output.connect(nodes.input);

        // Connect this effect to the next effect, or, if there is none,
        // the EffectChain target.
        if (next) {
          nodes.output.connect(next.input);
        }
      }

      if (value === descriptor.initial) {
        // If we're setting to the initial value, disconnect and discard the
        // effect's nodes. It's not necessary to keep nodes that don't cause
        // an effect in the chain. (We don't need to run the set() behavior
        // specified on the effect descriptor, since we're disconnecting and
        // discarding the nodes - the only values that function has access to.)
        if (nodes) {
          // There's no need to define custom disposal behavior per effect,
          // since it's always a matter of simply disconnecting every node.
          // The disconnect() method of a WebAudio node won't error if it's
          // already had all its connections removed, but we avoid redundant
          // calls here anyway.
          for (const node of new Set(Object.values(nodes))) {
            node.disconnect();
          }

          // We also need to establish a connection between the adjacent nodes
          // (which may be the EffectChain's input node and target node, if
          // there aren't any adjacent effect nodes).
          if (next) {
            previous.output.connect(next.input);
          }

          // Finally, we discard the object which holds the effect's nodes.
          // We aren't going to be using it anymore, and we need it gone so
          // that we recreate the nodes and correctly position them back in
          // the chain, if we use this effect again later.
          delete this.effectNodes[name];
        }
      } else {
        // The "as any" cast is needed because TypeScript can't infer that the
        // descriptor's name determines the type of its nodes
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        descriptor.set(value, nodes as any);
      }
    } else {
      // Non-"patch" effects operate directly on Sound objects, accessing
      // APIs provided by that class. The actual sound list is provided by the
      // caller of EffectChain.
      for (const sound of this.getNonPatchSoundList()) {
        descriptor.set(value, sound);
      }
    }
  }

  public connect(target: AudioNode): void {
    this.target = target;

    // All the code here is basically the same as what's written in
    // updateAudioEffect above; specific to this function, we want to
    // disconnect the final output in the chain - which may be the input
    // node - and then connect it to the newly specified target.

    let lastDescriptor: EffectDescriptorBase<EffectName> =
      EffectChain.getLastEffectDescriptor();
    do {
      lastDescriptor = EffectChain.getPreviousEffectDescriptor(
        lastDescriptor.name
      )!;
    } while (lastDescriptor && !this.effectNodes[lastDescriptor.name]);

    let last;
    if (lastDescriptor) {
      last = this.effectNodes[lastDescriptor.name]!;
    } else {
      last = { output: this.inputNode };
    }

    last.output.disconnect();
    last.output.connect(target);
  }

  public setEffectValue(
    name: EffectName,
    value: number | string | boolean
  ): void {
    value = Number(value);
    if (
      name in this.effectValues &&
      !isNaN(value) &&
      value !== this.effectValues[name]
    ) {
      this.effectValues[name] = value;
      this.clampEffectValue(name);
      this.updateAudioEffect(name);
    }
  }

  private changeEffectValue(
    name: EffectName,
    value: number | string | boolean
  ): void {
    value = Number(value);
    if (name in this.effectValues && !isNaN(value) && value !== 0) {
      this.effectValues[name] += value;
      this.clampEffectValue(name);
      this.updateAudioEffect(name);
    }
  }

  private clampEffectValue(name: EffectName): void {
    // Not all effects are clamped (pitch, for example); it's also possible to
    // specify only a minimum or maximum bound, instead of both.
    const descriptor = EffectChain.getEffectDescriptor(name);
    let value = this.effectValues[name];
    if (typeof descriptor.minimum === "number" && value < descriptor.minimum) {
      value = descriptor.minimum;
    } else if (
      typeof descriptor.maximum === "number" &&
      value > descriptor.maximum
    ) {
      value = descriptor.maximum;
    }
    this.effectValues[name] = value;
  }

  public getEffectValue(name: EffectName): number {
    return this.effectValues[name] || 0;
  }

  public clone(newConfig: EffectChainConfig): EffectChain {
    const newEffectChain = new EffectChain(
      Object.assign(
        {
          getNonPatchSoundList: this.getNonPatchSoundList,
        },
        newConfig
      )
    );

    for (const [name, value] of Object.entries(this.effectValues) as [
      EffectName,
      number
    ][]) {
      const descriptor = EffectChain.getEffectDescriptor(name);
      if (!descriptor.resetOnClone) {
        newEffectChain.setEffectValue(name, value);
      }
    }

    if (this.target) newEffectChain.connect(this.target);

    return newEffectChain;
  }

  public applyToSound(sound: Sound): void {
    sound.connect(this.inputNode);

    for (const [name, value] of Object.entries(this.effectValues) as [
      EffectName,
      number
    ][]) {
      const descriptor = EffectChain.getEffectDescriptor(name);
      if (!descriptor.isPatch) {
        (descriptor as PatchlessDescriptor<string>).set(value, sound);
      }
    }
  }

  public isTargetOf(sound: Sound): boolean {
    return sound.isConnectedTo(this.inputNode);
  }

  private static getInitialEffectValues(): Record<EffectName, number> {
    // This would be an excellent place to use Object.fromEntries, but that
    // function has been implemented in only the latest of a few modern
    // browsers. :P
    const initials: Partial<Record<EffectName, number>> = {};
    for (const { name, initial } of this.effectDescriptors) {
      initials[name] = initial;
    }
    return initials as Record<EffectName, number>;
  }

  private static getEffectDescriptor(
    name: EffectName
  ): typeof EffectChain["effectDescriptors"][number] {
    // We know this is non-null because this.effectDescriptors has every effect descriptor in it.
    // TODO: use a Record?
    return this.effectDescriptors.find(
      (descriptor) => descriptor.name === name
    )!;
  }

  private static getFirstEffectDescriptor(): typeof effectDescriptors[number] {
    return this.effectDescriptors[0];
  }

  private static getLastEffectDescriptor(): typeof effectDescriptors[number] {
    return this.effectDescriptors[this.effectDescriptors.length - 1];
  }

  private static getNextEffectDescriptor(
    name: EffectName
  ): typeof effectDescriptors[number] | undefined {
    // .find() provides three values to its passed function: the value of the
    // current item, that item's index, and the array on which .find() is
    // operating. In this case, we're only concerned with the index.
    // For each item in the list, besides the first, we check if the item
    // before it matches the name we were given. By initially shifting all the
    // descriptors using slice(1), the index of any item in the shifted list
    // corresponds to the previous item in the original list. Thus, if that
    // previous item matches the provided name, by definition, we'll have found
    // the item which comes after it.
    return this.effectDescriptors
      .slice(1)
      .find((_, i) => this.effectDescriptors[i].name === name);
  }

  private static getPreviousEffectDescriptor(
    name: EffectName
  ): typeof effectDescriptors[number] | undefined {
    // This function's a little simpler, since it doesn't involve shifting the
    // list. We still use slice(), but this time simply to cut off the last
    // item; that item will never come before any other, after all. We search
    // the list for the item whose following item matches the provided name,
    // using the more typical [i + 1] way of accessing an adjacent item.
    // (In getNextEffectDescriptor(), we don't need to offset the index like
    // that, because the shift already lines up the index as we need it.)
    return this.effectDescriptors
      .slice(0, -1)
      .find((_, i) => this.effectDescriptors[i + 1].name === name);
  }

  // These are constant values which can be affected to tweak the way effects
  // are applied. They match the values used in Scratch 3.0.
  public static decayDuration = 0.025;
  public static decayWait = 0.05;

  public static effectDescriptors = effectDescriptors;
}

export class AudioEffectMap implements Effects {
  // This class provides a simple interface for setting and getting audio
  // effects stored on an EffectChain, similar to EffectMap (that class being
  // for graphic effects). It takes an EffectChain and automatically generates
  // properties according to the names of the effect descriptors, acting with
  // the EffectChain's API when accessed.
  private effectChain: EffectChain;

  // TypeScript can't infer these
  public pan!: number;
  public pitch!: number;
  public volume!: number;

  public constructor(effectChain: EffectChain) {
    this.effectChain = effectChain;

    for (const { name } of EffectChain.effectDescriptors) {
      Object.defineProperty(this, name, {
        get: () => effectChain.getEffectValue(name),
        set: (value: string | number | boolean) =>
          effectChain.setEffectValue(name, value),
      });
    }
  }

  public clear(): void {
    this.effectChain.resetToInitial();
  }
}
