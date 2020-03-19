import Trigger from "./Trigger.js";
import Renderer from "./Renderer.js";
import Input from "./Input.js";
import { Stage } from "./Sprite.js";
import LoudnessHandler from "./Loudness.js";

export default class Project {
  constructor(stage, sprites = {}, { frameRate = 30 } = {}) {
    this.stage = stage;
    this.sprites = sprites;

    Object.freeze(sprites); // Prevent adding/removing sprites while project is running

    for (const sprite of this.spritesAndClones) {
      sprite._project = this;
    }
    this.stage._project = this;

    this.renderer = new Renderer(this);
    this.input = new Input(this.stage, this.renderer.stage, key => {
      this.fireTrigger(Trigger.KEY_PRESSED, { key });
    });

    this.loudnessHandler = new LoudnessHandler();

    this.runningTriggers = [];

    this.restartTimer();

    this.answer = null;

    if (
      this.spritesAndStage.some(spr =>
        spr.triggers.some(
          trig => trig.trigger === Trigger.LOUDNESS_GREATER_THAN
        )
      )
    ) {
      this.loudnessHandler.connect();
    }

    this._prevLoudness = 0;

    // Run project code at specified framerate
    setInterval(() => {
      this.step();
    }, 1000 / frameRate);

    // Render project as fast as possible
    this._renderLoop();
  }

  attach(renderTarget) {
    this.renderer.setRenderTarget(renderTarget);
    this.renderer.stage.addEventListener("click", () => {
      const wasClicked = sprite => {
        if (sprite instanceof Stage) {
          return true;
        }

        return this.renderer.checkPointCollision(
          sprite,
          {
            x: this.input.mouse.x,
            y: this.input.mouse.y
          },
          false
        );
      };

      let matchingTriggers = [];
      for (let i = 0; i < this.spritesAndStage.length; i++) {
        const sprite = this.spritesAndStage[i];
        const spriteClickedTriggers = sprite.triggers.filter(tr =>
          tr.matches(Trigger.CLICKED, {})
        );
        if (spriteClickedTriggers.length > 0) {
          if (wasClicked(sprite)) {
            matchingTriggers = [
              ...matchingTriggers,
              ...spriteClickedTriggers.map(trigger => ({
                trigger,
                target: sprite
              }))
            ];
          }
        }
      }

      this._startTriggers(matchingTriggers);
    });
  }

  greenFlag() {
    this.fireTrigger(Trigger.GREEN_FLAG);
    this.input.focus();
  }

  step() {
    if (this.loudnessHandler.loudness > this._prevLoudness) {
      this.fireGreatherThanTrigger(Trigger.LOUDNESS_GREATER_THAN);
    }
    this._prevLoudness = this.loudnessHandler.loudness;
    this.fireGreatherThanTrigger(Trigger.TIMER_GREATER_THAN);

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

  render() {
    // Render to canvas
    this.renderer.update(this.stage, this.spritesAndClones);

    // Update watchers
    for (const sprite of [...Object.values(this.sprites), this.stage]) {
      for (const watcher of Object.values(sprite.watchers)) {
        watcher.updateDOM(this.renderer.renderTarget);
      }
    }
  }

  _renderLoop() {
    requestAnimationFrame(this._renderLoop.bind(this));
    this.render();
  }

  fireTrigger(trigger, options) {
    // Special trigger behaviors
    if (trigger === Trigger.GREEN_FLAG) {
      this.restartTimer();
      this.stopAllSounds();
      this.runningTriggers = [];

      for (const spriteName in this.sprites) {
        const sprite = this.sprites[spriteName];
        sprite.clones = [];
      }

      for (const sprite of this.spritesAndStage) {
        sprite.effects.clear();
        sprite.audioEffects.clear();
      }
    }

    // Find triggers which match conditions
    let matchingTriggers = [];
    for (let i = 0; i < this.spritesAndStage.length; i++) {
      const sprite = this.spritesAndStage[i];
      const spriteTriggers = sprite.triggers.filter(tr =>
        tr.matches(trigger, options)
      );

      matchingTriggers = [
        ...matchingTriggers,
        ...spriteTriggers.map(trigger => ({ trigger, target: sprite }))
      ];
    }

    return this._startTriggers(matchingTriggers);
  }

  fireGreatherThanTrigger(trigger) {
    // GreaterThanTrigger are a bit different; we need to check if the value is bigger.
    let triggerMatcher = () => true;
    let triggerBeforeExecute = () => {};
    switch (trigger) {
      case Trigger.LOUDNESS_GREATER_THAN:
        triggerMatcher = trig =>
          trig.options.loudness < this.loudnessHandler.loudness;
        break;
      case Trigger.TIMER_GREATER_THAN:
        triggerMatcher = trig =>
          trig.options.timer < this.timer && !this.executed;
        triggerBeforeExecute = trig => (trig.executed = true);
        break;
      default:
        return;
    }
    const matchingTriggers = this.spritesAndStage.flatMap(spr => {
      return spr.triggers
        .filter(trig => trig.trigger === trigger && triggerMatcher(trig))
        .map(trig => ({ trigger: trig, target: spr }));
    });
    matchingTriggers.forEach(triggerBeforeExecute);
    return this._startTriggers(matchingTriggers);
  }

  _startTriggers(triggers) {
    // Only add these triggers to this.runningTriggers if they're not already there.
    // TODO: if the triggers are already running, they'll be restarted but their execution order is unchanged.
    // Does that match Scratch's behavior?
    for (const trigger of triggers) {
      if (
        !this.runningTriggers.find(
          runningTrigger =>
            trigger.trigger === runningTrigger.trigger &&
            trigger.target === runningTrigger.target
        )
      ) {
        this.runningTriggers.push(trigger);
      }
    }
    return Promise.all(
      triggers.map(({ trigger, target }) => {
        return trigger.start(target);
      })
    );
  }

  get spritesAndClones() {
    return Object.values(this.sprites)
      .flatMap(sprite => sprite.andClones())
      .sort((a, b) => a._layerOrder - b._layerOrder);
  }

  get spritesAndStage() {
    return [...this.spritesAndClones, this.stage];
  }

  changeSpriteLayer(sprite, layerDelta, relativeToSprite = sprite) {
    let spritesArray = this.spritesAndClones;

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

  stopAllSounds() {
    for (const target of this.spritesAndStage) {
      target.stopAllOfMySounds();
    }
  }

  restartTimer() {
    this.timerStart = new Date();
    this.spritesAndStage.forEach(spr =>
      spr.triggers.forEach(trig => {
        if (trig.trigger === Trigger.TIMER_GREATER_THAN) trig.executed = false;
      })
    );
  }

  get timer() {
    const ms = new Date() - this.timerStart;
    return ms / 1000;
  }

  async askAndWait(question) {
    this.answer = await this.renderer.displayAskBox(question);
  }
}
