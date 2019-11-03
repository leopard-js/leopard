import { Stage as StageBase, Costume, Trigger } from 'scratch-js'

import backdrop1 from './costumes/backdrop1.png'

export default class Stage extends StageBase {
  constructor(...args) {
    super(...args)

    this.costumes = [
      new Costume('backdrop1', backdrop1, { x: 240, y: 180 })
    ]

    this.triggers = [
      new Trigger(Trigger.GREEN_FLAG, this.greenFlag.bind(this))
    ]
  }

  * greenFlag() {
    console.log('Green flag!')
    yield* this.broadcastAndWait('turn cat')
  }
}