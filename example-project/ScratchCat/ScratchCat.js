import { Sprite, Trigger, Costume, Color } from "/scratch-js/index.js";

export default class ScratchCat extends Sprite {
  constructor(...args) {
    super(...args);

    this.costumes = [
      new Costume("costume1", "./ScratchCat/costumes/costume1.svg", {
        x: 48,
        y: 50
      }),
      new Costume("costume2", "./ScratchCat/costumes/costume2.svg", {
        x: 46,
        y: 53
      })
    ];

    this.triggers = [
      new Trigger(Trigger.CLICKED, this.whenthisspriteclicked),
      new Trigger(Trigger.GREEN_FLAG, this.whenGreenFlagClicked)
    ];
  }

  *whenthisspriteclicked() {
    this.costume = this.costumeNumber + 1;
  }

  *whenGreenFlagClicked() {
    this.costume = "costume1";
  }
}
