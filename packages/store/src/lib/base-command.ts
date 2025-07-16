import {FlagOptions} from './types.js'
import {checkForUndefinedFieldError} from '../services/store/utils/graphql-errors.js'
import Command from '@shopify/cli-kit/node/base-command'
import {renderError} from '@shopify/cli-kit/node/ui'

export abstract class BaseBDCommand extends Command {
  abstract runCommand(): Promise<void>

  flags: FlagOptions = {}

  async run(): Promise<void> {
    try {
      await this.runCommand()
    } catch (error) {
      if (error instanceof Error) {
        let errorMessage = error.message || 'An unknown error occurred'
        if (checkForUndefinedFieldError(error)) {
          errorMessage = `This command is in Early Accesss and is not yet available for the requested store(s).`
        }
        renderError({
          headline: `Operation failed`,
          body: errorMessage,
        })
        process.exit(1)
      } else {
        throw error
      }
    }
  }
}
