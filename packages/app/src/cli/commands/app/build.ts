import {Command} from '@oclif/core'
import {session, ui, error} from '@shopify/cli-kit'

export default class Build extends Command {
  static description = 'Build a block or an app'

  async run(): Promise<void> {
    // throw new error.Abort(`Something went wrong so we show this nice error`, 'you should try this other command: yes')
    const question: ui.Question = {
      type: 'input',
      name: 'template',
      message: 'Your app’s name? (You can change it later.)',
      default: 'my-app',
      validate: (value) => {
        if (value.length === 0) {
          return 'App Name cannot be empty'
        }
        if (value.length > 30) {
          return 'App name is too long (maximum is 30 characters)'
        }
        return true
      },
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
