import chooseConfigName from '../steps/chooseConfigName.js'
import existingApp from '../steps/existingApp.js'
import newApp from '../steps/newApp.js'
import start from '../steps/start.js'
import success from '../steps/success.js'
import writeFile from '../steps/writeFile.js'
import {AbortError} from '@shopify/cli-kit/node/error'

// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function transition({step, options}: {step: any; options?: any}) {
  try {
    await command.steps[step].render(options)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    await transition({step: 'error', options: error})
  }
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
    error: {
      render: (error: any) => {
        throw new AbortError(error)
      },
    },
  },
}

export function createStep(name: string, behavior: any) {
  return {
    [name]: {
      render: behavior,
    },
  }
}
