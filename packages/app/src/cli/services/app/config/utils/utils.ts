import chooseConfigName from '../steps/chooseConfigName.js'
import existingApp from '../steps/existingApp.js'
import newApp from '../steps/newApp.js'
import start from '../steps/start.js'
import success from '../steps/success.js'
import writeFile from '../steps/writeFile.js'

// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function transition({step, options}: {step: any; options?: any}) {
  return command.steps[step].render(options)
}

export async function startFlow(options: any) {
  return transition({step: command.initial, options})
}

export const command: any = {
  initial: 'start',
  steps: {
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
