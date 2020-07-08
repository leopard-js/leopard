import { Project } from "../dist/index.esm.js";

import Stage from "./Stage/Stage.js";
import ScratchCat from "./ScratchCat/ScratchCat.js";
import Gobo from "./Gobo/Gobo.js";
import Giga from "./Giga/Giga.js";

const stage = new Stage({ costumeNumber: 1 });

const sprites = {
  ScratchCat: new ScratchCat({
    x: 0,
    y: 30,
    direction: 90,
    costumeNumber: 1,
    size: 75,
    visible: true,
    layerOrder: 1
  }),
  Gobo: new Gobo({
    x: -20,
    y: -10,
    direction: 90,
    costumeNumber: 1,
    size: 75,
    visible: true,
    layerOrder: 3
  }),
  Giga: new Giga({
    x: 20,
    y: -10,
    direction: 90,
    costumeNumber: 1,
    size: 65,
    visible: true,
    layerOrder: 2
  })
};

const project = new Project(stage, sprites);
export default project;
