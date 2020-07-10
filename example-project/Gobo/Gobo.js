import { Sprite, Trigger, Costume, Color } from "../../dist/index.esm.js";

export default class Gobo extends Sprite {
  constructor(...args) {
    super(...args);

    this.costumes = [
      new Costume("goboA", "./Gobo/costumes/goboA.svg", { x: 47, y: 55 }),
      new Costume("goboB", "./Gobo/costumes/goboB.svg", { x: 47, y: 55 }),
      new Costume("goboC", "./Gobo/costumes/goboC.svg", { x: 47, y: 55 })
    ];

    this.triggers = [
      new Trigger(Trigger.CLICKED, this.whenthisspriteclicked),
      new Trigger(Trigger.GREEN_FLAG, this.whenGreenFlagClicked)
    ];

    this.visible = false;
  }

  *whenthisspriteclicked() {
    this.costume = "gobo" + "ABC"[this.random(1, 3) - 1];
  }

  *whenGreenFlagClicked() {
    this.costume = "goboA";
  }
}
