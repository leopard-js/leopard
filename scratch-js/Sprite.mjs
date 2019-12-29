import Trigger from "./Trigger.mjs";
import Color from "./Color.mjs";

class SpriteBase {
  constructor(initialConditions, vars = {}) {
    this._project = null;

    const { costumeNumber } = initialConditions;
    this._costumeNumber = costumeNumber;

    this.triggers = [];
    this.costumes = [];

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

  normalizeDeg(deg) {
    return ((deg - 180) % 360) + 180;
  }

  normalizeScratch(scratchDir) {
    const deg = this.scratchToDeg(scratchDir);
    const normalized = this.normalizeDeg(deg);
    return this.degToScratch(normalized);
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
}

export class Sprite extends SpriteBase {
  constructor(initialConditions, ...args) {
    super(initialConditions, ...args);

    const {
      x,
      y,
      direction,
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
    const parent = this.parent || this;
    const clone = Object.assign(
      Object.create(Object.getPrototypeOf(parent)),
      parent
    );

    clone._project = parent._project;

    clone.triggers = parent.triggers.map(
      trigger =>
        new Trigger(
          trigger.trigger,
          trigger.options,
          trigger._script.bind(clone)
        )
    );
    clone.costumes = parent.costumes;
    clone._vars = Object.assign({}, parent._vars);

    clone._speechBubble = {
      text: "",
      style: "say",
      timeout: null
    };

    clone.clones = [];
    clone.parent = parent;
    parent.clones.push(clone);

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

  get direction() {
    return this._direction;
  }

  set direction(dir) {
    this._direction = this.normalizeScratch(dir);
  }

  goto(x, y) {
    if (x === this.x && y === this.y) return;

    if (this.penDown) {
      this._project.renderer.penLine(
        { x: this._x, y: this._y },
        { x, y },
        this._penColor.toRGBString(),
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
        this._penColor.toRGBString(),
        this.penSize
      );
    }
    this._penDown = penDown;
  }

  get penColor() {
    return this._penColor;
  }

  set penColor(color) {
    if (typeof color === "number") {
      // Match Scratch rgba system
      // https://github.com/LLK/scratch-vm/blob/0dffc65ce99307d048f6b9a10b1c31b01ab0133d/src/util/color.js#L45
      const a = (color >> 24) & 0xff;
      const r = (color >> 16) & 0xff;
      const g = (color >> 8) & 0xff;
      const b = color & 0xff;
      this._penColor = Color.rgba(r, g, b, a / 255);
    } else if (color instanceof Color) {
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
              x: this.mouse.x + 240,
              y: 180 - this.mouse.y
            },
            fast
          );
        default:
          console.error(
            `Cannot find target "${target}" in "touching". Did you mean to pass a sprite class instead?`
          );
          return false;
      }
    }

    return this._project.renderer.checkSpriteCollision(this, target, fast);
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

export class Stage extends SpriteBase {
  constructor(...args) {
    super(...args);

    this.name = "Stage";
  }
}
