import chooseConfigName from '../steps/chooseConfigName.js'
import existingApp from '../steps/existingApp.js'
import newApp from '../steps/newApp.js'
import start from '../steps/start.js'
import success from '../steps/success.js'
import writeFile from '../steps/writeFile.js'

// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function transition({state, options}: {state: any; options: any}) {
  return machine.states[state].render(options)
}

export async function startFlow(options: any) {
  return transition({state: machine.initial, options})
}

export const machine: any = {
  initial: 'start',
  states: {
    ...start,
    ...newApp,
    ...existingApp,
    ...chooseConfigName,
    ...writeFile,
    ...success,
  },
}

export function createStep(name: string, behavior: any) {
  return {
    [name]: {
      render: behavior,
    },
  }
}
