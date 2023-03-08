import Color from "./Color";
import Trigger from "./Trigger";
import Sound, { EffectChain, AudioEffectMap } from "./Sound";
import Costume from "./Costume";
import type { Mouse } from "./Input";
import type Project from "./Project";
import type Watcher from "./Watcher";
import type { Yielding } from "./lib/yielding";

import { effectNames } from "./renderer/effectInfo";

type Effects = {
  [x in typeof effectNames[number]]: number;
};

// This is a wrapper to allow the enabled effects in a sprite to be used as a Map key.
// By setting an effect, the bitmask is updated as well.
// This allows the bitmask to be used to uniquely identify a set of enabled effects.
export class _EffectMap implements Effects {
  public _bitmask: number;
  private _effectValues: Record<typeof effectNames[number], number>;
  // TODO: TypeScript can't automatically infer these
  public color!: number;
  public fisheye!: number;
  public whirl!: number;
  public pixelate!: number;
  public mosaic!: number;
  public brightness!: number;
  public ghost!: number;

  public constructor() {
    this._bitmask = 0;
    this._effectValues = {
      color: 0,
      fisheye: 0,
      whirl: 0,
      pixelate: 0,
      mosaic: 0,
      brightness: 0,
      ghost: 0,
    };

    for (let i = 0; i < effectNames.length; i++) {
      const effectName = effectNames[i];

      Object.defineProperty(this, effectName, {
        get: () => {
          return this._effectValues[effectName];
        },

        set: (val: number) => {
          this._effectValues[effectName] = val;

          if (val === 0) {
            // If the effect value is 0, meaning it's disabled, set its bit in the bitmask to 0.
            this._bitmask = this._bitmask & ~(1 << i);
          } else {
            // Otherwise, set its bit to 1.
            this._bitmask = this._bitmask | (1 << i);
          }
        },
      });
    }
  }

  public _clone(): _EffectMap {
    const m = new _EffectMap();
    for (const effectName of Object.keys(
      this._effectValues
    ) as (keyof typeof this._effectValues)[]) {
      m[effectName] = this[effectName];
    }
    return m;
  }

  public clear(): void {
    for (const effectName of Object.keys(
      this._effectValues
    ) as (keyof typeof this._effectValues)[]) {
      this._effectValues[effectName] = 0;
    }
    this._bitmask = 0;
  }
}

export type SpeechBubble = {
  text: string;
  style: "say" | "think";
  timeout: number | null;
};

type InitialConditions = {
  costumeNumber: number;
  layerOrder?: number;
};

abstract class SpriteBase<Vars extends object = object> {
  // TODO: make private
  public _project!: Project;

  protected _costumeNumber: number;
  // TODO: make private
  public _layerOrder: number;
  public triggers: Trigger[];
  public watchers: Partial<Record<string, Watcher>>;
  protected costumes: Costume[];
  protected sounds: Sound[];

  protected effectChain: EffectChain;
  public effects: _EffectMap;
  public audioEffects: AudioEffectMap;

  public _speechBubble?: SpeechBubble;

  protected _vars: Vars;

  public constructor(initialConditions: InitialConditions, vars: Vars) {
    // TODO: pass project in here, ideally
    const { costumeNumber, layerOrder = 0 } = initialConditions;
    this._costumeNumber = costumeNumber;
    this._layerOrder = layerOrder;

    this.triggers = [];
    this.watchers = {};
    this.costumes = [];
    this.sounds = [];

    this.effectChain = new EffectChain({
      getNonPatchSoundList: this.getSoundsPlayedByMe.bind(this),
    });
    this.effectChain.connect(Sound.audioContext.destination);

    this.effects = new _EffectMap();
    this.audioEffects = new AudioEffectMap(this.effectChain);

    this._vars = vars;
  }

  protected getSoundsPlayedByMe(): Sound[] {
    return this.sounds.filter((sound) => this.effectChain.isTargetOf(sound));
  }

  public get stage(): Stage {
    return this._project.stage;
  }

  public get sprites(): Partial<Record<string, Sprite>> {
    return this._project.sprites;
  }

  public get vars(): Vars {
    return this._vars;
  }

  public get costumeNumber(): number {
    return this._costumeNumber;
  }

  public set costumeNumber(number) {
    if (Number.isFinite(number)) {
      this._costumeNumber = this.wrapClamp(number, 1, this.costumes.length);
    } else {
      this._costumeNumber = 0;
    }
  }

  public set costume(costume: number | string | Costume) {
    if (costume instanceof Costume) {
      const costumeIndex = this.costumes.indexOf(costume);
      if (costumeIndex > -1) {
        this.costumeNumber = costumeIndex + 1;
      }
    }
    if (typeof costume === "number") {
      this.costumeNumber = costume;
      return;
    }
    if (typeof costume === "string") {
      const index = this.costumes.findIndex((c) => c.name === costume);
      if (index > -1) {
        this.costumeNumber = index + 1;
      } else {
        switch (costume) {
          case "next costume":
          case "next backdrop": {
            this.costumeNumber = this.costumeNumber + 1;
            break;
          }

          case "previous costume":
          case "previous backdrop": {
            this.costumeNumber = this.costumeNumber - 1;
            break;
          }

          case "random costume":
          case "random backdrop": {
            // Based on joker314's inclusiveRandIntWithout: https://github.com/LLK/scratch-vm/pull/2011
            // Note: We use 1 -> length instead of 0 -> length-1, since we want a 1-indexed result.
            const lower = 1;
            const upper = this.costumes.length;
            const excluded = this.costumeNumber;

            const possibleOptions = upper - lower;
            let randInt = lower + Math.floor(Math.random() * possibleOptions);
            if (randInt >= excluded) {
              randInt++;
            }

            this.costumeNumber = randInt;
            break;
          }

          default: {
            if (!Number.isNaN(Number(costume)) && costume.trim().length !== 0) {
              this.costumeNumber = Number(costume);
            }
          }
        }
      }
    }
  }

  public get costume(): Costume {
    return this.costumes[this.costumeNumber - 1];
  }

  public degToRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  public radToDeg(rad: number): number {
    return (rad * 180) / Math.PI;
  }

  public degToScratch(deg: number): number {
    return -deg + 90;
  }

  public scratchToDeg(scratchDir: number): number {
    return -scratchDir + 90;
  }

  public radToScratch(rad: number): number {
    return this.degToScratch(this.radToDeg(rad));
  }

  public scratchToRad(scratchDir: number): number {
    return this.degToRad(this.scratchToDeg(scratchDir));
  }

  // From scratch-vm's math-util.
  public scratchTan(angle: number): number {
    angle = angle % 360;
    switch (angle) {
      case -270:
      case 90:
        return Infinity;
      case -90:
      case 270:
        return -Infinity;
      default:
        return parseFloat(Math.tan((Math.PI * angle) / 180).toFixed(10));
    }
  }

  // Wrap rotation from -180 to 180.
  public normalizeDeg(deg: number): number {
    // This is a pretty big math expression, but it's necessary because in JavaScript,
    // the % operator means "remainder", not "modulo", and so negative numbers won't "wrap around".
    // See https://web.archive.org/web/20090717035140if_/javascript.about.com/od/problemsolving/a/modulobug.htm
    return ((((deg + 180) % 360) + 360) % 360) - 180;
  }

  // Keep a number between two limits, wrapping "extra" into the range.
  // wrapClamp(7, 1, 5) == 2
  // wrapClamp(0, 1, 5) == 5
  // wrapClamp(-11, -10, 6) == 6
  // Borrowed from scratch-vm (src/util/math-util.js)
  public wrapClamp(n: number, min: number, max: number): number {
    const range = max - min + 1;
    return n - Math.floor((n - min) / range) * range;
  }

  // Given a generator function, return a version of it that runs in "warp mode" (no yields).
  public warp(procedure: GeneratorFunction): (...args: unknown[]) => void {
    const bound = procedure.bind(this);
    return (...args) => {
      const inst = bound(...args);
      while (!inst.next().done);
    };
  }

  // TODO: this should also take strings so rand("0.0", "1.0") returns a random float like Scratch
  public random(a: number, b: number): number {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    if (min % 1 === 0 && max % 1 === 0) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    return Math.random() * (max - min) + min;
  }

  public *wait(secs: number): Yielding<void> {
    const endTime = new Date();
    endTime.setMilliseconds(endTime.getMilliseconds() + secs * 1000);
    while (new Date() < endTime) {
      yield;
    }
  }

  public get mouse(): Mouse {
    return this._project.input.mouse;
  }

  public keyPressed(name: string): boolean {
    return this._project.input.keyPressed(name);
  }

  public get timer(): number {
    return this._project.timer;
  }

  public restartTimer(): void {
    this._project.restartTimer();
  }

  public *startSound(soundName: string): Yielding<void> {
    const sound = this.getSound(soundName);
    if (sound) {
      this.effectChain.applyToSound(sound);
      yield* sound.start();
    }
  }

  public *playSoundUntilDone(soundName: string): Yielding<void> {
    const sound = this.getSound(soundName);
    if (sound) {
      sound.connect(this.effectChain.inputNode);
      this.effectChain.applyToSound(sound);
      yield* sound.playUntilDone();
    }
  }

  public getSound(soundName: string): Sound | undefined {
    if (typeof soundName === "number") {
      return this.sounds[(soundName - 1) % this.sounds.length];
    } else {
      return this.sounds.find((s) => s.name === soundName);
    }
  }

  public stopAllSounds(): void {
    this._project.stopAllSounds();
  }

  public stopAllOfMySounds(): void {
    for (const sound of this.sounds) {
      sound.stop();
    }
  }

  public broadcast(name: string): Promise<void> {
    return this._project.fireTrigger(Trigger.BROADCAST, { name });
  }

  public *broadcastAndWait(name: string): Yielding<void> {
    let running = true;
    void this.broadcast(name).then(() => {
      running = false;
    });

    while (running) {
      yield;
    }
  }

  public clearPen(): void {
    this._project.renderer.clearPen();
  }

  public *askAndWait(question: string): Yielding<void> {
    if (this._speechBubble && this instanceof Sprite) {
      this.say("");
    }

    let done = false;
    void this._project.askAndWait(question).then(() => {
      done = true;
    });

    while (!done) yield;
  }

  public get answer(): string | null {
    return this._project.answer;
  }

  public get loudness(): number {
    return this._project.loudness;
  }

  public toNumber(value: unknown): number {
    if (typeof value === "number") {
      if (isNaN(value)) {
        return 0;
      }
      return value;
    }

    const n = Number(value);
    if (Number.isNaN(n)) {
      return 0;
    }
    return n;
  }

  public toBoolean(value: unknown): boolean {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      if (value === "" || value === "0" || value.toLowerCase() === "false") {
        return false;
      }
      return true;
    }

    return Boolean(value);
  }

  public toString(value: unknown): string {
    return String(value);
  }

  public stringIncludes(string: string, substring: string): boolean {
    return string.toLowerCase().includes(substring.toLowerCase());
  }

  public arrayIncludes<T>(array: T[], value: T): boolean {
    return array.some((item) => this.compare(item, value) === 0);
  }

  public letterOf(string: string, index: number): string {
    if (index < 0 || index >= string.length) {
      return "";
    }
    return string[index];
  }

  public itemOf<T>(array: T[], index: number): T | "" {
    if (index < 0 || index >= array.length) {
      return "";
    }
    return array[index];
  }

  public indexInArray<T>(array: T[], value: T): number {
    return array.findIndex((item) => this.compare(item, value) === 0);
  }

  public compare(v1: unknown, v2: unknown): number {
    if (v1 === v2) {
      return 0;
    }

    let n1 = Number(v1);
    let n2 = Number(v2);
    if (
      (n1 === Infinity && n2 === Infinity) ||
      (n1 === -Infinity && n2 === -Infinity)
    ) {
      return 0;
    }

    if (
      n1 === 0 &&
      (v1 === null || (typeof v1 === "string" && v1.trim().length === 0))
    ) {
      n1 = NaN;
    } else if (
      n2 === 0 &&
      (v2 === null || (typeof v2 === "string" && v2.trim().length === 0))
    ) {
      n2 = NaN;
    }

    if (!isNaN(n1) && !isNaN(n2)) {
      return n1 - n2;
    }

    const s1 = String(v1).toLowerCase();
    const s2 = String(v2).toLowerCase();

    if (s1 === s2) {
      return 0;
    } else if (s1 < s2) {
      return -1;
    } else {
      return 1;
    }
  }
}

type RotationStyle =
  typeof Sprite["RotationStyle"][keyof typeof Sprite["RotationStyle"]];

type SpriteInitialConditions = {
  x: number;
  y: number;
  direction: number;
  rotationStyle?: RotationStyle;
  costumeNumber: number;
  size: number;
  visible: boolean;
  penDown?: boolean;
  penSize?: number;
  penColor?: Color;
};

export class Sprite<Vars extends object = object> extends SpriteBase<Vars> {
  private _x: number;
  private _y: number;
  private _direction: number;
  public rotationStyle: RotationStyle;
  public size: number;
  public visible: boolean;

  private parent: Sprite | null;
  public clones: Sprite<Vars>[];

  private _penDown: boolean;
  public penSize: number;
  private _penColor: Color;

  public constructor(initialConditions: SpriteInitialConditions, vars: Vars) {
    super(initialConditions, vars);

    const {
      x,
      y,
      direction,
      rotationStyle,
      costumeNumber,
      size,
      visible,
      penDown,
      penSize,
      penColor,
    } = initialConditions;

    this._x = x;
    this._y = y;
    this._direction = direction;
    this.rotationStyle = rotationStyle || Sprite.RotationStyle.ALL_AROUND;
    this._costumeNumber = costumeNumber;
    this.size = size;
    this.visible = visible;

    this.parent = null;
    this.clones = [];

    this._penDown = penDown || false;
    this.penSize = penSize || 1;
    this._penColor = penColor || Color.rgb(0, 0, 255);

    this._speechBubble = {
      text: "",
      style: "say",
      timeout: null,
    };
  }

  public createClone(): void {
    const clone = Object.assign(
      Object.create(Object.getPrototypeOf(this) as object) as Sprite,
      this
    );

    clone._project = this._project;
    clone.triggers = this.triggers.map((trigger) => trigger.clone());
    clone.costumes = this.costumes;
    clone.sounds = this.sounds;
    clone._vars = Object.assign({}, this._vars);

    clone._speechBubble = {
      text: "",
      style: "say",
      timeout: null,
    };

    clone.effects = this.effects._clone();

    // Clones inherit audio effects from the original sprite, for some reason.
    // Couldn't explain it, but that's the behavior in Scratch 3.0.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let original: Sprite = this;
    while (original.parent) {
      original = original.parent;
    }
    clone.effectChain = original.effectChain.clone({
      getNonPatchSoundList: clone.getSoundsPlayedByMe.bind(clone),
    });

    // Make a new audioEffects interface which acts on the cloned effect chain.
    clone.audioEffects = new AudioEffectMap(clone.effectChain);

    clone.clones = [];
    clone.parent = this;
    this.clones.push(clone);

    // Trigger CLONE_START:
    const triggers = clone.triggers.filter((tr) =>
      tr.matches(Trigger.CLONE_START, {}, clone)
    );
    void this._project._startTriggers(
      triggers.map((trigger) => ({ trigger, target: clone }))
    );
  }

  public deleteThisClone(): void {
    if (this.parent === null) return;

    this.parent.clones = this.parent.clones.filter((clone) => clone !== this);

    this._project.runningTriggers = this._project.runningTriggers.filter(
      ({ target }) => target !== this
    );
  }

  // TODO: is this necessary now that the clone hierarchy seems to be flattened?
  public andClones(): Sprite[] {
    return [this, ...this.clones.flatMap((clone) => clone.andClones())];
  }

  public get direction(): number {
    return this._direction;
  }

  public set direction(dir) {
    this._direction = this.normalizeDeg(dir);
  }

  public goto(x: number, y: number): void {
    if (x === this.x && y === this.y) return;

    if (this.penDown) {
      this._project.renderer.penLine(
        { x: this._x, y: this._y },
        { x, y },
        this._penColor,
        this.penSize
      );
    }

    this._x = x;
    this._y = y;
  }

  public get x(): number {
    return this._x;
  }

  public set x(x) {
    this.goto(x, this._y);
  }

  public get y(): number {
    return this._y;
  }

  public set y(y) {
    this.goto(this._x, y);
  }

  public move(dist: number): void {
    const moveDir = this.scratchToRad(this.direction);

    this.goto(
      this._x + dist * Math.cos(moveDir),
      this._y + dist * Math.sin(moveDir)
    );
  }

  public *glide(seconds: number, x: number, y: number): Yielding<void> {
    const interpolate = (a: number, b: number, t: number): number =>
      a + (b - a) * t;

    const startTime = new Date();
    const startX = this._x;
    const startY = this._y;

    let t;
    do {
      t = (new Date().getTime() - startTime.getTime()) / (seconds * 1000);
      this.goto(interpolate(startX, x, t), interpolate(startY, y, t));
      yield;
    } while (t < 1);
  }

  public moveAhead(value = Infinity): void {
    if (typeof value === "number") {
      this._project.changeSpriteLayer(this, value);
    } else {
      this._project.changeSpriteLayer(this, 1, value);
    }
  }

  public moveBehind(value = Infinity): void {
    if (typeof value === "number") {
      this._project.changeSpriteLayer(this, -value);
    } else {
      this._project.changeSpriteLayer(this, -1, value);
    }
  }

  public get penDown(): boolean {
    return this._penDown;
  }

  public set penDown(penDown) {
    if (penDown) {
      this._project.renderer.penLine(
        { x: this.x, y: this.y },
        { x: this.x, y: this.y },
        this._penColor,
        this.penSize
      );
    }
    this._penDown = penDown;
  }

  public get penColor(): Color {
    return this._penColor;
  }

  public set penColor(color: unknown) {
    if (color instanceof Color) {
      this._penColor = color;
    } else {
      console.error(
        `${String(color)} is not a valid penColor. Try using the Color class!`
      );
    }
  }

  public stamp(): void {
    this._project.renderer.stamp(this);
  }

  public touching(
    target: "mouse" | "edge" | Sprite | Stage,
    fast = false
  ): boolean {
    if (typeof target === "string") {
      switch (target) {
        case "mouse":
          return this._project.renderer.checkPointCollision(
            this,
            {
              x: this.mouse.x,
              y: this.mouse.y,
            },
            fast
          );
        case "edge": {
          const bounds = this._project.renderer.getTightBoundingBox(this);
          const stageWidth = this.stage.width;
          const stageHeight = this.stage.height;
          return (
            bounds.left < -stageWidth / 2 ||
            bounds.right > stageWidth / 2 ||
            bounds.top > stageHeight / 2 ||
            bounds.bottom < -stageHeight / 2
          );
        }
        default:
          console.error(
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `Cannot find target "${target}" in "touching". Did you mean to pass a sprite class instead?`
          );
          return false;
      }
    } else if (target instanceof Color) {
      return this._project.renderer.checkColorCollision(this, target);
    }

    return this._project.renderer.checkSpriteCollision(this, target, fast);
  }

  public colorTouching(color: Color, target: Sprite | Stage): boolean {
    if (typeof target === "string") {
      console.error(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Cannot find target "${target}" in "touchingColor". Did you mean to pass a sprite class instead?`
      );
      return false;
    }

    if (typeof color === "string") {
      console.error(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Cannot find color "${color}" in "touchingColor". Did you mean to pass a Color instance instead?`
      );
      return false;
    }

    if (target instanceof Color) {
      // "Color is touching color"
      return this._project.renderer.checkColorCollision(this, target, color);
    } else {
      // "Color is touching sprite" (not implemented in Scratch!)
      return this._project.renderer.checkSpriteCollision(
        this,
        target,
        false,
        color
      );
    }
  }

  public say(text: string): void {
    if (this._speechBubble?.timeout) clearTimeout(this._speechBubble.timeout);
    this._speechBubble = { text: String(text), style: "say", timeout: null };
  }

  public think(text: string): void {
    if (this._speechBubble?.timeout) clearTimeout(this._speechBubble.timeout);
    this._speechBubble = { text: String(text), style: "think", timeout: null };
  }

  public *sayAndWait(text: string, seconds: number): Yielding<void> {
    if (this._speechBubble?.timeout) clearTimeout(this._speechBubble.timeout);

    const speechBubble: SpeechBubble = { text, style: "say", timeout: null };
    let done = false;
    const timeout = window.setTimeout(() => {
      speechBubble.text = "";
      speechBubble.timeout = null;
      done = true;
    }, seconds * 1000);

    speechBubble.timeout = timeout;
    this._speechBubble = speechBubble;
    while (!done) yield;
  }

  public *thinkAndWait(text: string, seconds: number): Yielding<void> {
    if (this._speechBubble?.timeout) clearTimeout(this._speechBubble.timeout);

    const speechBubble: SpeechBubble = { text, style: "think", timeout: null };
    let done = false;
    const timeout = window.setTimeout(() => {
      speechBubble.text = "";
      speechBubble.timeout = null;
      done = true;
    }, seconds * 1000);

    speechBubble.timeout = timeout;
    this._speechBubble = speechBubble;
    while (!done) yield;
  }

  public static RotationStyle = Object.freeze({
    ALL_AROUND: Symbol("ALL_AROUND"),
    LEFT_RIGHT: Symbol("LEFT_RIGHT"),
    DONT_ROTATE: Symbol("DONT_ROTATE"),
  });
}

type StageInitialConditions = {
  width?: number;
  height?: number;
} & InitialConditions;

export class Stage<Vars extends object = object> extends SpriteBase<Vars> {
  public readonly width!: number;
  public readonly height!: number;
  public __counter: number;

  public constructor(initialConditions: StageInitialConditions, vars: Vars) {
    super(initialConditions, vars);

    // Use defineProperties to make these non-writable.
    // Changing the width and height of the stage after initialization isn't supported.
    Object.defineProperties(this, {
      width: {
        value: initialConditions.width || 480,
        enumerable: true,
      },
      height: {
        value: initialConditions.height || 360,
        enumerable: true,
      },
    });

    // For obsolete counter blocks.
    this.__counter = 0;
  }

  public fireBackdropChanged(): Promise<void> {
    return this._project.fireTrigger(Trigger.BACKDROP_CHANGED, {
      backdrop: this.costume.name,
    });
  }

  public get costumeNumber(): number {
    return super.costumeNumber;
  }

  public set costumeNumber(number) {
    super.costumeNumber = number;
    void this.fireBackdropChanged();
  }
}
