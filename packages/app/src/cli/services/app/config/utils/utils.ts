import existingApp from '../steps/existingApp.js'
import newApp from '../steps/newApp.js'
import start from '../steps/start.js'
import success from '../steps/success.js'

// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function transition({state, options}: {state: any; options: any}) {
  await machine.states[state].render(options)
}

export async function startFlow(options: any) {
  await transition({state: machine.initial, options})
}

export const machine: any = {
  initial: 'start',
  states: {
    ...start,
    ...newApp,
    ...existingApp,
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
