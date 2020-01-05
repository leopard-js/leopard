import { Sprite, Trigger, Costume } from "../../scratch-js/index.mjs";

export default class Dog extends Sprite {
  constructor(...args) {
    super(...args);

    this.name = "Dog";

    this.costumes = [
      new Costume("dog", "./Dog/costumes/dog.png", { x: 26, y: 15 })
    ];

    this.triggers = [
      new Trigger(Trigger.GREEN_FLAG, this.greenFlag),
      new Trigger(Trigger.CLONE_START, this.whenIStartAsClone),
      new Trigger(Trigger.CLONE_START, this.whenIStartAsClone2)
    ];
  }

  *greenFlag() {
    this.say("Help!");

    while (true) {
      this.createClone();
      yield* this.wait(this.random(0.3, 1.0));
    }
  }

  *whenIStartAsClone() {
    this.size = 150;
    this.goto(this.random(-240, 240), 200);
    yield* this.glide(this.random(1.5, 2.5), this.x, -200);
    this.deleteThisClone();
  }

  *whenIStartAsClone2() {
    this.vars.dirVel = this.random(-5, 5);
    this.vars.effect = [
      "whirl",
      "fisheye",
      "pixelate",
      "mosaic",
      "brightness",
      "ghost"
    ][this.random(0, 5)];

    while (true) {
      this.direction += this.vars.dirVel;
      this.effects[this.vars.effect] += 1;
      yield;
    }
  }
}
