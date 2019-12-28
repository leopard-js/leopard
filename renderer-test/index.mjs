import { Project } from "../scratch-js/index.mjs";

import Stage from "./Stage/Stage.mjs";
import Dog from "./Dog/Dog.mjs";
import Cat from "./Cat/Cat.mjs";

const stage = new Stage({ costumeNumber: 1 }, { myGlobalVar: "hello" });

const sprites = {
  cat: new Cat({
    x: 0,
    y: 0,
    direction: 90,
    costumeNumber: 1,
    size: 100,
    visible: true
  }),
  dog: new Dog({
    x: 50,
    y: -100,
    direction: 45,
    costumeNumber: 1,
    size: 300,
    visible: true
  })
};

const project = new Project(stage, sprites);

project.attach("#project");

document.querySelector("#greenFlag").addEventListener("click", () => {
  project.greenFlag();
});

// Play on load
project.greenFlag();
