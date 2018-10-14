import { Project, Vars } from 'scratch-js'
import Sprite1 from './sprites/Sprite1/Sprite1.js'

const sprites = [
  new Sprite1(
    // Initial sprite conditions
    {
      x: 0,
      y: 0,
      direction: 90,
      costumeNumber: 1,
      size: 100
    },

    // Sprite variables
    new Vars({
      myVar: 2
    })
  )
]

const globalVars = new Vars({
  test: 0
})

const project = new Project(sprites, globalVars)

project.run()