import Trigger, { TriggerOptions } from "./Trigger";
import Renderer from "./Renderer";
import Input from "./Input";
import LoudnessHandler from "./Loudness";
import Sound from "./Sound";
import { Stage, Sprite } from "./Sprite";
import Thread, { ThreadStatus } from "./Thread";

type TriggerWithTarget = {
  target: Sprite | Stage;
  trigger: Trigger;
};

export default class Project {
  public stage: Stage;
  public sprites: Partial<Record<string, Sprite>>;
  /**
   * All rendered targets (the stage, sprites, and clones), in layer order.
   * This is kept private so that nobody can improperly modify it. The only way
   * to add or remove targets is via the appropriate methods, and iteration can
   * be done with {@link forEachTarget}.
   */
  private targets: (Sprite | Stage)[];
  public renderer: Renderer;
  public input: Input;

  private loudnessHandler: LoudnessHandler;
  private _cachedLoudness: number | null;

  public threads: Thread[];

  public answer: string | null;
  private timerStart!: Date;

  /**
   * Used to keep track of what edge-activated trigger predicates evaluted to
   * on the previous step.
   */
  private _prevStepTriggerPredicates: WeakMap<Trigger, boolean>;

  public constructor(stage: Stage, sprites = {}, { frameRate = 30 } = {}) {
    this.stage = stage;
    this.sprites = sprites;

    this.targets = [
      stage,
      ...Object.values(this.sprites as Record<string, Sprite>),
    ];
    this.targets.sort((a, b) => {
      // There should only ever be one stage, but it's best to maintain a total
      // ordering to avoid weird sorting-algorithm stuff from happening if
      // there's more than one
      if (a instanceof Stage && !(b instanceof Stage)) {
        return -1;
      }
      if (b instanceof Stage && !(a instanceof Stage)) {
        return 1;
      }

      return a.getInitialLayerOrder() - b.getInitialLayerOrder();
    });
    for (const target of this.targets) {
      target.clearInitialLayerOrder();
      target._project = this;
    }

    Object.freeze(sprites); // Prevent adding/removing sprites while project is running

    this.renderer = new Renderer(this, null);
    this.input = new Input(this.stage, this.renderer.stage, (key) => {
      this.fireTrigger(Trigger.KEY_PRESSED, { key });
    });

    this.loudnessHandler = new LoudnessHandler();
    // Only update loudness once per step.
    this._cachedLoudness = null;

    this.threads = [];
    this._prevStepTriggerPredicates = new WeakMap();

    this.restartTimer();

    this.answer = null;

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

      let clickedSprite = this.renderer.pick(this.targets, {
        x: this.input.mouse.x,
        y: this.input.mouse.y,
      });
      if (!clickedSprite) {
        clickedSprite = this.stage;
      }

      const matchingTriggers = [];
      for (const trigger of clickedSprite.triggers) {
        if (trigger.matches(Trigger.CLICKED, {}, clickedSprite)) {
          matchingTriggers.push({ trigger, target: clickedSprite });
        }
      }

      this._startThreads(matchingTriggers);
    });
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
    const matchingTriggers = [];
    // Iterate over targets in top-down order, as Scratch does
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const target = this.targets[i];
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
          predicate = this.timer > (trigger.option("VALUE", target) as number);
          break;
        case Trigger.LOUDNESS_GREATER_THAN:
          predicate =
            this.loudness > (trigger.option("VALUE", target) as number);
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
        triggersToStart.push({ trigger, target });
      }
    }
    void this._startThreads(triggersToStart);
  }

  private step(): void {
    this._cachedLoudness = null;
    this._stepEdgeActivatedTriggers();

    // Step all threads
    const threads = this.threads;
    for (let i = 0; i < threads.length; i++) {
      threads[i].step();
    }

    // Remove finished threads
    this.threads = this.threads.filter(
      (thread) => thread.status !== ThreadStatus.DONE
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

  public fireTrigger(trigger: symbol, options?: TriggerOptions): Thread[] {
    // Special trigger behaviors
    if (trigger === Trigger.GREEN_FLAG) {
      this.restartTimer();
      this.stopAllSounds();
      this.threads = [];

      this.filterSprites((sprite) => {
        if (!sprite.isOriginal) return false;

        sprite.effects.clear();
        sprite.audioEffects.clear();
        return true;
      });
    }

    const matchingTriggers = this._matchingTriggers((tr, target) =>
      tr.matches(trigger, options, target)
    );

    return this._startThreads(matchingTriggers);
  }

  // TODO: add a way to start clone triggers from fireTrigger then make this private
  public _startThreads(triggers: TriggerWithTarget[]): Thread[] {
    const startedThreads = [];
    // Only add these threads to this.threads if they're not already there.
    // TODO: if the threads are already running, they'll be restarted but their execution order is unchanged.
    // Does that match Scratch's behavior?
    for (const { trigger, target } of triggers) {
      const existingThread = this.threads.find(
        (thread) => thread.trigger === trigger && thread.target === target
      );
      if (existingThread) {
        existingThread.restart();
        startedThreads.push(existingThread);
      } else {
        const thread = new Thread(trigger, target);
        this.threads.push(thread);
        startedThreads.push(thread);
      }
    }
    return startedThreads;
  }

  public addSprite(sprite: Sprite, behind?: Sprite): void {
    if (behind) {
      const currentIndex = this.targets.indexOf(behind);
      this.targets.splice(currentIndex, 0, sprite);
    } else {
      this.targets.push(sprite);
    }
  }

  public removeSprite(sprite: Sprite): void {
    const index = this.targets.indexOf(sprite);
    if (index === -1) return;

    this.targets.splice(index, 1);
    this.cleanupSprite(sprite);
  }

  public filterSprites(predicate: (sprite: Sprite) => boolean): void {
    let nextKeptSpriteIndex = 0;
    for (let i = 0; i < this.targets.length; i++) {
      const target = this.targets[i];
      if (target instanceof Stage || predicate(target)) {
        this.targets[nextKeptSpriteIndex] = target;
        nextKeptSpriteIndex++;
      } else {
        this.cleanupSprite(target);
      }
    }
    this.targets.length = nextKeptSpriteIndex;
  }

  private cleanupSprite(sprite: Sprite): void {
    this.threads = this.threads.filter(({ target }) => target !== sprite);
  }

  public changeSpriteLayer(
    sprite: Sprite,
    layerDelta: number,
    relativeToSprite = sprite
  ): void {
    const spritesArray = this.targets;

    const originalIndex = spritesArray.indexOf(sprite);
    const relativeToIndex = spritesArray.indexOf(relativeToSprite);

    let newIndex = relativeToIndex + layerDelta;
    if (newIndex < 0) newIndex = 0;
    if (newIndex > spritesArray.length - 1) newIndex = spritesArray.length - 1;

    // Remove sprite from originalIndex and insert at newIndex
    spritesArray.splice(originalIndex, 1);
    spritesArray.splice(newIndex, 0, sprite);
  }

  public forEachTarget(callback: (target: Sprite | Stage) => void): void {
    for (const target of this.targets) {
      callback(target);
    }
  }

  public stopAllSounds(): void {
    for (const target of this.targets) {
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
