import {
  Stage as StageBase,
  Costume,
  Trigger
} from "../../scratch-js/index.mjs";

export default class Stage extends StageBase {
  constructor(...args) {
    super(...args);

    this.costumes = [
      new Costume("backdrop1", "./Stage/costumes/backdrop1.png", {
        x: 240,
        y: 180
      })
    ];

    this.triggers = [new Trigger(Trigger.GREEN_FLAG, this.greenFlag)];
  }

  *greenFlag() {
    yield* this.askAndWait("What is your name?");
    console.log(`Hello, ${this.answer}!`);
  }
}
