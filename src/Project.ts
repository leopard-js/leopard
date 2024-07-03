import Trigger, { TriggerOptions } from "./Trigger";
import Renderer from "./Renderer";
import Input from "./Input";
import LoudnessHandler from "./Loudness";
import Sound from "./Sound";
import type { Stage, Sprite } from "./Sprite";

type TriggerWithTarget = {
  target: Sprite | Stage;
  trigger: Trigger;
};

export default class Project {
  public stage: Stage;
  public sprites: Partial<Record<string, Sprite>>;
  public renderer: Renderer;
  public input: Input;

  private loudnessHandler: LoudnessHandler;
  private _cachedLoudness: number | null;

  public runningTriggers: TriggerWithTarget[];

  public answer: string | null;
  private timerStart!: Date;

  public draggingSprite: Sprite | null;
  public dragThreshold: number;
  private _consideringDraggingSprite: Sprite | null;
  private _dragOffsetX: number;
  private _dragOffsetY: number;
  private _idleDragTimeout: number | null;

  /**
   * Used to keep track of what edge-activated trigger predicates evaluted to
   * on the previous step.
   */
  private _prevStepTriggerPredicates: WeakMap<Trigger, boolean>;

  public constructor(stage: Stage, sprites = {}, { frameRate = 30 } = {}) {
    this.stage = stage;
    this.sprites = sprites;

    Object.freeze(sprites); // Prevent adding/removing sprites while project is running

    for (const sprite of this.spritesAndClones) {
      sprite._project = this;
    }
    this.stage._project = this;

    this.renderer = new Renderer(this, null);
    this.input = new Input(this.stage, this.renderer.stage, (key) => {
      void this.fireTrigger(Trigger.KEY_PRESSED, { key });
    });

    this.loudnessHandler = new LoudnessHandler();
    // Only update loudness once per step.
    this._cachedLoudness = null;

    this.runningTriggers = [];
    this._prevStepTriggerPredicates = new WeakMap();

    this.restartTimer();

    this.answer = null;
    this.draggingSprite = null;
    this._consideringDraggingSprite = null;
    this._dragOffsetX = 0;
    this._dragOffsetY = 0;
    this._idleDragTimeout = null;

    // TODO: Enable customizing, like frameRate
    this.dragThreshold = 3;

    // Run project code at specified framerate
    setInterval(() => {
      this.step();
    }, 1000 / frameRate);

    // Render project as fast as possible
    this._renderLoop();
  }

  public attach(renderTarget: string | HTMLElement): void {
    this.renderer.setRenderTarget(renderTarget);

    this.renderer.stage.addEventListener("click", () => {
      // Chrome requires a user gesture on the page before we can start the
      // audio context.
      // When we click the stage, that counts as a user gesture, so try
      // resuming the audio context.
      if (Sound.audioContext.state === "suspended") {
        void Sound.audioContext.resume();
      }
    });

    this.renderer.stage.addEventListener("mousedown", () => {
      const spriteUnderMouse = this._spriteUnderMouse;
      const targetUnderMouse = this._targetUnderMouse;
      if (spriteUnderMouse && spriteUnderMouse.draggable) {
        this._consideringDraggingSprite = spriteUnderMouse;
        this._startIdleDragTimeout();
      } else {
        this._startClickTriggersFor(targetUnderMouse);
      }
    });

    this.renderer.stage.addEventListener("mousemove", () => {
      // TODO: Effects - goto() and moveAhead() - are applied immediately.
      // Do we want to buffer them to apply at the start of the next tick?
      if (this.input.mouse.down) {
        if (this._consideringDraggingSprite && this.input.mouse.downAt) {
          const distanceX = this.input.mouse.x - this.input.mouse.downAt.x;
          const distanceY = this.input.mouse.y - this.input.mouse.downAt.y;
          const distanceFromMouseDown = Math.sqrt(
            distanceX ** 2 + distanceY ** 2
          );
          if (distanceFromMouseDown > this.dragThreshold) {
            this._startDragging();
          }
        }

        if (this.draggingSprite) {
          const gotoX = this.input.mouse.x + this._dragOffsetX;
          const gotoY = this.input.mouse.y + this._dragOffsetY;
          this.draggingSprite.goto(gotoX, gotoY, true);
        }
      }
    });

    this.renderer.stage.addEventListener("mouseup", () => {
      if (!this._clearDragging()) {
        const spriteUnderMouse = this._spriteUnderMouse;
        if (spriteUnderMouse && spriteUnderMouse.draggable) {
          this._startClickTriggersFor(spriteUnderMouse);
        }
      }
    });

    if (this.renderer.stage.ownerDocument) {
      this.renderer.stage.ownerDocument.addEventListener("mouseup", () => {
        void this._clearDragging();
      });
    }
  }

  public greenFlag(): void {
    // Chrome requires a user gesture on the page before we can start the
    // audio context.
    // When greenFlag is triggered, it's likely that the cause of it was some
    // kind of button click, so try resuming the audio context.
    if (Sound.audioContext.state === "suspended") {
      void Sound.audioContext.resume();
    }
    void this.fireTrigger(Trigger.GREEN_FLAG);
    this.input.focus();
  }

  // Find triggers which match the given condition
  private _matchingTriggers(
    triggerMatches: (tr: Trigger, target: Sprite | Stage) => boolean
  ): TriggerWithTarget[] {
    const matchingTriggers: TriggerWithTarget[] = [];
    const targets = this.spritesAndStage;
    for (const target of targets) {
      const matchingTargetTriggers = target.triggers.filter((tr) =>
        triggerMatches(tr, target)
      );
      for (const match of matchingTargetTriggers) {
        matchingTriggers.push({ trigger: match, target });
      }
    }
    return matchingTriggers;
  }

  private _stepEdgeActivatedTriggers(): void {
    const edgeActivated = this._matchingTriggers((tr) => tr.isEdgeActivated);
    const triggersToStart: TriggerWithTarget[] = [];
    for (const triggerWithTarget of edgeActivated) {
      const { trigger, target } = triggerWithTarget;
      let predicate;
      switch (trigger.trigger) {
        case Trigger.TIMER_GREATER_THAN:
          predicate = this.timer > trigger.option("VALUE", target)!;
          break;
        case Trigger.LOUDNESS_GREATER_THAN:
          predicate = this.loudness > trigger.option("VALUE", target)!;
          break;
        default:
          throw new Error(`Unimplemented trigger ${String(trigger.trigger)}`);
      }

      // Default to false
      const prevPredicate = !!this._prevStepTriggerPredicates.get(trigger);
      this._prevStepTriggerPredicates.set(trigger, predicate);

      // The predicate evaluated to false last time and true this time
      // Activate the trigger
      if (!prevPredicate && predicate) {
        triggersToStart.push(triggerWithTarget);
      }
    }
    void this._startTriggers(triggersToStart);
  }

  private _startClickTriggersFor(target: Sprite | Stage): void {
    const matchingTriggers: TriggerWithTarget[] = [];
    for (const trigger of target.triggers) {
      if (trigger.matches(Trigger.CLICKED, {}, target)) {
        matchingTriggers.push({ trigger, target });
      }
    }

    void this._startTriggers(matchingTriggers);
  }

  private get _spriteUnderMouse(): Sprite | null {
    return this.renderer.pick(this.spritesAndClones, {
      x: this.input.mouse.x,
      y: this.input.mouse.y,
    });
  }

  private get _targetUnderMouse(): Sprite | Stage {
    return this._spriteUnderMouse || this.stage;
  }

  private _startDragging(): void {
    if (this._consideringDraggingSprite) {
      this.draggingSprite = this._consideringDraggingSprite;
      this._consideringDraggingSprite = null;
      this._clearIdleDragTimeout();

      this._dragOffsetX = this.draggingSprite.x - this.input.mouse.x;
      this._dragOffsetY = this.draggingSprite.y - this.input.mouse.y;

      this.draggingSprite.moveAhead();
    }
  }

  private _clearDragging(): boolean {
    const wasDragging = !!this.draggingSprite;
    this.draggingSprite = null;
    this._consideringDraggingSprite = null;
    this._dragOffsetX = 0;
    this._dragOffsetY = 0;
    this._clearIdleDragTimeout();
    return wasDragging;
  }

  private _startIdleDragTimeout(): void {
    this._idleDragTimeout = window.setTimeout(
      this._startDragging.bind(this),
      400
    );
  }

  private _clearIdleDragTimeout(): void {
    if (typeof this._idleDragTimeout === "number") {
      clearTimeout(this._idleDragTimeout);
      this._idleDragTimeout = null;
    }
  }

  private step(): void {
    this._cachedLoudness = null;
    this._stepEdgeActivatedTriggers();

    // Step all triggers
    const alreadyRunningTriggers = this.runningTriggers;
    for (let i = 0; i < alreadyRunningTriggers.length; i++) {
      alreadyRunningTriggers[i].trigger.step();
    }

    // Remove finished triggers
    this.runningTriggers = this.runningTriggers.filter(
      ({ trigger }) => !trigger.done
    );
  }

  private render(): void {
    // Render to canvas
    this.renderer.update();

    // Update watchers
    if (this.renderer.renderTarget) {
      for (const sprite of [...Object.values(this.sprites), this.stage]) {
        for (const watcher of Object.values(sprite!.watchers)) {
          watcher!.updateDOM(this.renderer.renderTarget);
        }
      }
    }
  }

  private _renderLoop(): void {
    requestAnimationFrame(this._renderLoop.bind(this));
    this.render();
  }

  public fireTrigger(trigger: symbol, options?: TriggerOptions): Promise<void> {
    // Special trigger behaviors
    if (trigger === Trigger.GREEN_FLAG) {
      this.restartTimer();
      this.stopAllSounds();
      this.runningTriggers = [];

      for (const spriteName in this.sprites) {
        const sprite = this.sprites[spriteName]!;
        sprite.clones = [];
      }

      for (const sprite of this.spritesAndStage) {
        sprite.effects.clear();
        sprite.audioEffects.clear();
      }
    }

    const matchingTriggers = this._matchingTriggers((tr, target) =>
      tr.matches(trigger, options, target)
    );

    return this._startTriggers(matchingTriggers);
  }

  // TODO: add a way to start clone triggers from fireTrigger then make this private
  public async _startTriggers(triggers: TriggerWithTarget[]): Promise<void> {
    // Only add these triggers to this.runningTriggers if they're not already there.
    // TODO: if the triggers are already running, they'll be restarted but their execution order is unchanged.
    // Does that match Scratch's behavior?
    for (const trigger of triggers) {
      if (
        !this.runningTriggers.find(
          (runningTrigger) =>
            trigger.trigger === runningTrigger.trigger &&
            trigger.target === runningTrigger.target
        )
      ) {
        this.runningTriggers.push(trigger);
      }
    }
    await Promise.all(
      triggers.map(({ trigger, target }) => trigger.start(target))
    );
  }

  public get spritesAndClones(): Sprite[] {
    return Object.values(this.sprites)
      .flatMap((sprite) => sprite!.andClones())
      .sort((a, b) => a._layerOrder - b._layerOrder);
  }

  public get spritesAndStage(): (Sprite | Stage)[] {
    return [...this.spritesAndClones, this.stage];
  }

  public changeSpriteLayer(
    sprite: Sprite,
    layerDelta: number,
    relativeToSprite = sprite
  ): void {
    const spritesArray = this.spritesAndClones;

    const originalIndex = spritesArray.indexOf(sprite);
    const relativeToIndex = spritesArray.indexOf(relativeToSprite);

    let newIndex = relativeToIndex + layerDelta;
    if (newIndex < 0) newIndex = 0;
    if (newIndex > spritesArray.length - 1) newIndex = spritesArray.length - 1;

    // Remove sprite from originalIndex and insert at newIndex
    spritesArray.splice(originalIndex, 1);
    spritesArray.splice(newIndex, 0, sprite);

    // spritesArray is sorted correctly, but to influence
    // the actual order of the sprites we need to update
    // each one's _layerOrder property.
    spritesArray.forEach((sprite, index) => {
      sprite._layerOrder = index + 1;
    });
  }

  public stopAllSounds(): void {
    for (const target of this.spritesAndStage) {
      target.stopAllOfMySounds();
    }
  }

  public get timer(): number {
    const ms = new Date().getTime() - this.timerStart.getTime();
    return ms / 1000;
  }

  public restartTimer(): void {
    this.timerStart = new Date();
  }

  public async askAndWait(question: string): Promise<void> {
    this.answer = await this.renderer.displayAskBox(question);
  }

  public get loudness(): number {
    if (this._cachedLoudness === null) {
      this._cachedLoudness = this.loudnessHandler.getLoudness();
    }
    return this._cachedLoudness;
  }
}
