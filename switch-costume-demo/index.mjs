import { Project } from "/scratch-js/index.mjs";

import Stage from "./Stage/Stage.mjs";
import ScratchCat from "./ScratchCat/ScratchCat.mjs";
import Gobo from "./Gobo/Gobo.mjs";
import Giga from "./Giga/Giga.mjs";

const stage = new Stage({ costumeNumber: 1 });

const sprites = {
  ScratchCat: new ScratchCat({
    x: -183,
    y: 119.99999999999999,
    direction: 90,
    costumeNumber: 1,
    size: 75,
    visible: true
  }),
  Gobo: new Gobo({
    x: -177,
    y: 14.999999999999993,
    direction: 90,
    costumeNumber: 1,
    size: 75,
    visible: true
  }),
  Giga: new Giga({
    x: -172.00000000000003,
    y: -121.00000000000001,
    direction: 90,
    costumeNumber: 1,
    size: 65,
    visible: true
  })
};

const project = new Project(stage, sprites);
export default project;
