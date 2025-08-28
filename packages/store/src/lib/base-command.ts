import {FlagOptions} from './types.js'
import Command from '@shopify/cli-kit/node/base-command'
import {AbortError} from '@shopify/cli-kit/node/error'

export abstract class BaseBDCommand extends Command {
  abstract runCommand(): Promise<void>

  flags: FlagOptions = {}

  async run(): Promise<void> {
    try {
      await this.runCommand()
    } catch (error) {
      if (error instanceof Error) {
        const errorMessage = error.message || 'An unknown error occurred'
        throw new AbortError(errorMessage)
      } else {
        throw error
      }
    }
  }
}
