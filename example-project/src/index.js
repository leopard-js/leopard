import { Project, Vars } from 'scratch-js'

import Player from './sprites/Player/Player'
import Ground from './sprites/Ground/Ground'

const sprites = [
  new Player(
    // Initial sprite conditions
    {
      x: -183,
      y: -105,
      direction: 90,
      costumeNumber: 1,
      size: 60
    },

    // Sprite variables
    new Vars({
      xVel: 0,
      yVel: 0,
      oldY: 0
    })
  ),
  new Ground(
    // Initial sprite conditions
    {
      x: 0,
      y: 0,
      direction: 90,
      costumeNumber: 1,
      size: 100
    }
  )
]

const project = new Project(sprites)

project.run()