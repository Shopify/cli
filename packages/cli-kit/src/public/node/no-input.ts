import {isTruthy} from './context/utilities.js'
import {Flags} from '@oclif/core'

export const noInputFlag = {
  'no-input': Flags.boolean({
    description: 'Disable interactive prompts and browser authentication.',
    env: 'SHOPIFY_FLAG_NO_INPUT',
  }),
}

/**
 * Returns whether the current process explicitly disabled user input.
 *
 * @param argv - Process arguments to inspect.
 * @param environment - Environment variables to inspect.
 * @returns True when `--no-input` is active.
 */
export function isInputDisabled(argv: string[] = process.argv, environment: NodeJS.ProcessEnv = process.env): boolean {
  return argv.includes('--no-input') || isTruthy(environment.SHOPIFY_FLAG_NO_INPUT)
}
