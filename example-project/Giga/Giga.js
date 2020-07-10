import { Sprite, Trigger, Costume, Color } from "../../dist/index.esm.js";

export default class Giga extends Sprite {
  constructor(...args) {
    super(...args);

    this.costumes = [
      new Costume("giga-a", "./Giga/costumes/gigaA.svg", { x: 72, y: 96 }),
      new Costume("giga-b", "./Giga/costumes/gigaB.svg", { x: 72, y: 96 })
    ];

    this.triggers = [
      new Trigger(Trigger.CLICKED, this.whenthisspriteclicked),
      new Trigger(Trigger.GREEN_FLAG, this.whenGreenFlagClicked)
    ];

    this.visible = false;
  }

  *whenthisspriteclicked() {
    this.costume = "next costume";
  }

  *whenGreenFlagClicked() {
    this.costume = "giga-a";
  }
}
