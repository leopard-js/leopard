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

    this.renderer.stage.addEventListener("mousedown", event => {
      this._startIdleDragTimeout();

      const spriteUnderMouse = this.renderer.pick(this.spritesAndClones, {
        x: this.input.mouse.x,
        y: this.input.mouse.y,
      });

      if (spriteUnderMouse) {
        // Draggable sprites' click triggers are started when the mouse is released
        // (provided no drag has started by that point). However, they still occlude
        // a click on the stage.
        if (!spriteUnderMouse.draggable) {
          this._startClickTriggersFor(spriteUnderMouse);
        }
      } else {
        // If there's no sprite under the mouse at all, the stage was clicked.
        this._startClickTriggersFor(this.stage);
      }
    });

    this.renderer.stage.addEventListener("mousemove", () => {
      if (this.input.mouse.down) {
        if (!this.draggingSprite) {
          // Consider dragging based on if the mouse has traveled far from where it was pressed down.
          const distanceX = this.input.mouse.x - this.input.mouse.downAt!.x;
          const distanceY = this.input.mouse.y - this.input.mouse.downAt!.y;
          const distanceFromMouseDown = Math.sqrt(
            distanceX ** 2 + distanceY ** 2
          );
          if (distanceFromMouseDown > this.dragThreshold) {
            // Try starting dragging from where the mouse was pressed down. Yes, this means we're
            // checking for the presence of a draggable sprite *where the mouse was pressed down,
            // no matter where it is now.* This makes for subtly predictable and hilarious hijinks:
            // https://github.com/scratchfoundation/scratch-gui/pull/1434#issuecomment-2207679144
            this._tryStartingDraggingFrom(this.input.mouse.downAt!.x, this.input.mouse.downAt!.y);
          }
        }

        if (this.draggingSprite) {
          const gotoX = this.input.mouse.x + this._dragOffsetX;
          const gotoY = this.input.mouse.y + this._dragOffsetY;

          // TODO: This is applied immediately. Do we want to buffer it til the start of the next tick?
          this.draggingSprite.goto(gotoX, gotoY, true);
        }
      }
    });

    this.renderer.stage.addEventListener("mouseup", () => {
      // Releasing the mouse terminates a drag, and if this is the case, don't start click triggers.
      if (this._clearDragging()) {
        return;
      }

      const spriteUnderMouse = this.renderer.pick(this.spritesAndClones, {
        x: this.input.mouse.x,
        y: this.input.mouse.y,
      });

      // Only draggable sprites start click triggers when the mouse is released.
      // Non-draggable sprites' click triggers are started when the mouse is pressed.
      if (spriteUnderMouse && spriteUnderMouse.draggable) {
        this._startClickTriggersFor(spriteUnderMouse);
      }
    });

    if (this.renderer.stage.ownerDocument) {
      this.renderer.stage.ownerDocument.addEventListener("mouseup", () => {
        // Releasing the mouse outside of the stage canvas should never start click triggers,
        // so we don't care if a drag was actually cleared or not.
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

  private _tryStartingDraggingFrom(x: number, y: number): void {
    const spriteUnderMouse = this.renderer.pick(this.spritesAndClones, { x, y });
    if (spriteUnderMouse && spriteUnderMouse.draggable) {
      this.draggingSprite = spriteUnderMouse;
      this._clearIdleDragTimeout();

      // Note the drag offset is in terms of where the drag is starting from, not where the mouse is now.
      // This has the apparent effect of teleporting the sprite a significant distance, if you moved your
      // mouse far away from where you pressed it down.
      this._dragOffsetX = this.draggingSprite.x - x;
      this._dragOffsetY = this.draggingSprite.y - y;

      // TODO: This is applied immediately. Do we want to buffer it til the start of the next tick?
      this.draggingSprite.moveAhead();
    }
  }

  private _clearDragging(): boolean {
    const wasDragging = !!this.draggingSprite;
    this.draggingSprite = null;
    this._dragOffsetX = 0;
    this._dragOffsetY = 0;
    this._clearIdleDragTimeout();
    return wasDragging;
  }

  private _startIdleDragTimeout(): void {
    // We call this the "idle drag timeout" because it's only relevant if you haven't moved the mouse
    // past the drag threshold, so that you'd just call _tryStartDraggingFrom normally. (Or you *have*
    // moved it past the threshold, but are not currently moving it on the frame when this timeout
    // activates.) Note that the bind is to the position of the mouse when the mouse is pressed down,
    // i.e. it will start dragging regardless where the mouse actually is when this timeout activates -
    // although usually, it's in the same place, because you just pressed it down and held it still.
    this._idleDragTimeout = window.setTimeout(
      this._tryStartingDraggingFrom.bind(this, this.input.mouse.x, this.input.mouse.y),
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
