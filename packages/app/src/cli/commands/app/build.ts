import {Command} from '@oclif/core'
import {session, ui, error} from '@shopify/cli-kit'

export default class Build extends Command {
  static description = 'Build a block or an app'

  async run(): Promise<void> {
    throw new error.Abort(`This is a custom error`)

    const question: ui.Question = {
      type: 'input',
      name: 'template',
      message: 'Your app’s name? (You can change it later.)',
      default: 'my-app',
    }

    const qqu: ui.Question = {
      type: 'select',
      name: 'extension_type',
      message: 'What type of script would you like to build? (Select with ↑ ↓ ⏎)',
      default: 'extension',
      choices: ['1. Discount', '2. Payment method', '3. Shipping method'],
    }

    const result = await ui.prompt([question, qqu])
    // console.log(result)
  }
}
