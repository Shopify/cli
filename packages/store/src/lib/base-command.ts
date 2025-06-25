import {FlagOptions} from './types.js'
import Command from '@shopify/cli-kit/node/base-command'
import {renderText, renderError} from '@shopify/cli-kit/node/ui'

export abstract class BaseBDCommand extends Command {
  abstract runCommand(): Promise<void>

  flags: FlagOptions = {}

  async run(): Promise<void> {
    try {
      await this.runCommand()
    } catch (error) {
      if (error instanceof Error) {
        renderError({
          headline: `Operation failed`,
          body: error.message,
        })
      } else {
        throw error
      }
    }
  }

  handleExit() {
    renderText({text: 'Exiting.'})
    process.exit(0)
  }
}
