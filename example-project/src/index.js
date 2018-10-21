import { Project, Vars } from 'scratch-js'

import Stage from './Stage/Stage'
import Border from './Border/Border'
import Drawer from './Drawer/Drawer'

const stage = new Stage({
  costumeNumber: 1
})

const sprites = [
  new Border(
    // Initial sprite conditions
    {
      x: 0,
      y: 0,
      direction: 90,
      costumeNumber: 2,
      size: 100,
      visible: true
    }
  ),
  new Drawer(
    {
      x: 0,
      y: 0,
      direction: 90,
      costumeNumber: 1,
      size: 100,
      visible: false,
      penDown: false,
      penSize: 1,
      penColor: 'blue'
    },

    // Sprite vars
    new Vars({
      i: 0
    })
  )
]

const project = new Project(stage, sprites)

project.run()