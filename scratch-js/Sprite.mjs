import Trigger from "./Trigger.mjs";
import Color from "./Color.mjs";

import effectNames from "./renderer/effectNames.mjs";
// This is a wrapper to allow the enabled effects in a sprite to be used as a Map key.
// By setting an effect, the bitmask is updated as well.
// This allows the bitmask to be used to uniquely identify a set of enabled effects.
class _EffectMap {
  constructor() {
    this._bitmask = 0;
    this._effectValues = {};

    for (let i = 0; i < effectNames.length; i++) {
      const effectName = effectNames[i];
      this._effectValues[effectName] = 0;

      Object.defineProperty(this, effectName, {
        get: () => {
          return this._effectValues[effectName];
        },

        set: val => {
          this._effectValues[effectName] = val;

          if (val === 0) {
            // If the effect value is 0, meaning it's disabled, set its bit in the bitmask to 0.
            this._bitmask = this._bitmask & ~(1 << i);
          } else {
            // Otherwise, set its bit to 1.
            this._bitmask = this._bitmask | (1 << i);
          }
        }
      });
    }
  }

  _clone() {
    const m = new _EffectMap();
    for (const effectName of Object.keys(this._effectValues)) {
      m[effectName] = this[effectName];
    }
    return m;
  }

  clear() {
    for (const effectName of Object.keys(this._effectValues)) {
      this._effectValues[effectName] = 0;
    }
    this._bitmask = 0;
  }
}

class SpriteBase {
  constructor(initialConditions, vars = {}) {
    this._project = null;

    const { costumeNumber } = initialConditions;
    this._costumeNumber = costumeNumber;

    this.triggers = [];
    this.costumes = [];

    this.effects = new _EffectMap();

    this._vars = vars;
  }

  get stage() {
    return this._project.stage;
  }

  get sprites() {
    return this._project.sprites;
  }

  get vars() {
    return this._vars;
  }

  get costumeNumber() {
    return this._costumeNumber;
  }

  set costumeNumber(number) {
    this._costumeNumber = ((number - 1) % this.costumes.length) + 1;
  }

  set costume(costume) {
    if (typeof costume === "number") {
      this.costumeNumber = costume;
    }
    if (typeof costume === "string") {
      const index = this.costumes.findIndex(c => c.name === costume);
      if (index > -1) this.costumeNumber = index + 1;
    }
  }

  get costume() {
    return this.costumes[this.costumeNumber - 1];
  }

  degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  radToDeg(rad) {
    return (rad * 180) / Math.PI;
  }

  degToScratch(deg) {
    return -deg + 90;
  }

  scratchToDeg(scratchDir) {
    return -scratchDir + 90;
  }

  radToScratch(rad) {
    return this.degToScratch(this.radToDeg(rad));
  }

  scratchToRad(scratchDir) {
    return this.degToRad(this.scratchToDeg(scratchDir));
  }

  // Wrap rotation from -180 to 180.
  normalizeDeg(deg) {
    // This is a pretty big math expression, but it's necessary because in JavaScript,
    // the % operator means "remainder", not "modulo", and so negative numbers won't "wrap around".
    // See https://web.archive.org/web/20090717035140if_/javascript.about.com/od/problemsolving/a/modulobug.htm
    return ((((deg + 180) % 360) + 360) % 360) - 180;
  }

  random(a, b) {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    if (min % 1 === 0 && max % 1 === 0) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    return Math.random() * (max - min) + min;
  }

  *wait(secs) {
    let endTime = new Date();
    endTime.setMilliseconds(endTime.getMilliseconds() + secs * 1000);
    while (new Date() < endTime) {
      yield;
    }
  }

  get mouse() {
    return this._project.input.mouse;
  }

  keyPressed(name) {
    return this._project.input.keyPressed(name);
  }

  get timer() {
    const ms = new Date() - this._project.timerStart;
    return ms / 1000;
  }

  restartTimer() {
    this._project.restartTimer();
  }

  *playSound(url) {
    let playing = true;
    this._project.playSound(url).then(() => {
      playing = false;
    });

    while (playing) yield;
  }

  stopAllSounds() {
    this._project.stopAllSounds();
  }

  broadcast(name) {
    return this._project.fireTrigger(Trigger.BROADCAST, { name });
  }

  *broadcastAndWait(name) {
    let running = true;
    this.broadcast(name).then(() => {
      running = false;
    });

    while (running) {
      yield;
    }
  }

  clearPen() {
    this._project.renderer.clearPen();
  }

  *askAndWait(question) {
    if (this._speechBubble) {
      this.say(null);
    }

    let done = false;
    this._project.askAndWait(question).then(() => {
      done = true;
    });

    while (!done) yield;
  }

  get answer() {
    return this._project.answer;
  }
}

export class Sprite extends SpriteBase {
  constructor(initialConditions, ...args) {
    super(initialConditions, ...args);

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
      penColor
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
    this._penColor = penColor || Color.rgb(0, 0, 0);

    this._speechBubble = {
      text: "",
      style: "say",
      timeout: null
    };
  }

  createClone() {
    const clone = Object.assign(
      Object.create(Object.getPrototypeOf(this)),
      this
    );

    clone._project = this._project;
    clone.triggers = this.triggers.map(
      trigger => new Trigger(trigger.trigger, trigger.options, trigger._script)
    );
    clone.costumes = this.costumes;
    clone._vars = Object.assign({}, this._vars);

    clone._speechBubble = {
      text: "",
      style: "say",
      timeout: null
    };

    clone.effects = this.effects._clone();

    clone.clones = [];
    clone.parent = this;
    this.clones.push(clone);

    // Trigger CLONE_START:
    const triggers = clone.triggers.filter(tr =>
      tr.matches(Trigger.CLONE_START)
    );
    this._project._startTriggers(
      triggers.map(trigger => ({ trigger, target: clone }))
    );
  }

  deleteThisClone() {
    if (this.parent === null) return;

    this.parent.clones = this.parent.clones.filter(clone => clone !== this);

    this._project.runningTriggers = this._project.runningTriggers.filter(
      ({ target }) => target !== this
    );
  }

  andClones() {
    return [this, ...this.clones.flatMap(clone => clone.andClones())];
  }

  get direction() {
    return this._direction;
  }

  set direction(dir) {
    this._direction = this.normalizeDeg(dir);
  }

  goto(x, y) {
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

  get x() {
    return this._x;
  }

  set x(x) {
    this.goto(x, this._y);
  }

  get y() {
    return this._y;
  }

  set y(y) {
    this.goto(this._x, y);
  }

  move(dist) {
    const moveDir = this.scratchToRad(this.direction);

    this.goto(
      this._x + dist * Math.cos(moveDir),
      this._y + dist * Math.sin(moveDir)
    );
  }

  *glide(seconds, x, y) {
    const interpolate = (a, b, t) => a + (b - a) * t;

    const startTime = new Date();
    const startX = this._x;
    const startY = this._y;

    let t;
    do {
      t = (new Date() - startTime) / (seconds * 1000);
      this.goto(interpolate(startX, x, t), interpolate(startY, y, t));
      yield;
    } while (t < 1);
  }

  get penDown() {
    return this._penDown;
  }

  set penDown(penDown) {
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

  get penColor() {
    return this._penColor;
  }

  set penColor(color) {
    if (color instanceof Color) {
      this._penColor = color;
    } else {
      console.error(
        `${color} is not a valid penColor. Try using the Color class!`
      );
    }
  }

  stamp() {
    this._project.renderer.stamp(this);
  }

  touching(target, fast = false) {
    if (typeof target === "string") {
      switch (target) {
        case "mouse":
          return this._project.renderer.checkPointCollision(
            this,
            {
              x: this.mouse.x,
              y: this.mouse.y
            },
            fast
          );
        default:
          console.error(
            `Cannot find target "${target}" in "touching". Did you mean to pass a sprite class instead?`
          );
          return false;
      }
    } else if (target instanceof Color) {
      return this._project.renderer.checkColorCollision(this, target);
    }

    return this._project.renderer.checkSpriteCollision(this, target, fast);
  }

  colorTouching(color, target) {
    if (typeof target === "string") {
      console.error(
        `Cannot find target "${target}" in "touchingColor". Did you mean to pass a sprite class instead?`
      );
      return false;
    }

    if (typeof color === "string") {
      console.error(
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

  say(text) {
    clearTimeout(this._speechBubble.timeout);
    this._speechBubble = { text, style: "say", timeout: null };
  }

  think(text) {
    clearTimeout(this._speechBubble.timeout);
    this._speechBubble = { text, style: "think", timeout: null };
  }

  *sayAndWait(text, seconds) {
    clearTimeout(this._speechBubble.timeout);

    let done = false;
    const timeout = setTimeout(() => {
      this._speechBubble.text = "";
      this.timeout = null;
      done = true;
    }, seconds * 1000);

    this._speechBubble = { text, style: "say", timeout };
    while (!done) yield;
  }

  *thinkAndWait(text, seconds) {
    clearTimeout(this._speechBubble.timeout);

    let done = false;
    const timeout = setTimeout(() => {
      this._speechBubble.text = "";
      this.timeout = null;
      done = true;
    }, seconds * 1000);

    this._speechBubble = { text, style: "think", timeout };
    while (!done) yield;
  }
}

Sprite.RotationStyle = Object.freeze({
  ALL_AROUND: Symbol("ALL_AROUND"),
  LEFT_RIGHT: Symbol("LEFT_RIGHT"),
  DONT_ROTATE: Symbol("DONT_ROTATE")
});

export class Stage extends SpriteBase {
  constructor(initialConditions, ...args) {
    super(initialConditions, ...args);

    // Use defineProperties to make these non-writable.
    // Changing the width and height of the stage after initialization isn't supported.
    Object.defineProperties(this, {
      width: {
        value: initialConditions.width || 480,
        enumerable: true
      },
      height: {
        value: initialConditions.height || 360,
        enumerable: true
      }
    });

    this.name = "Stage";

    // For obsolete counter blocks.
    this.counter = 0;
  }
}
