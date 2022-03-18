import {Command} from '@oclif/core'
import {session, ui} from '@shopify/cli-kit'

export default class Build extends Command {
  static description = 'Build a block or an app'

  async run(): Promise<void> {
    const question: ui.Question = {
      type: 'input',
      name: 'template',
      message: 'Choose a template',
      default: 'template-hydrogen-minimum',
      choices: ['template-hydrogen-default', 'template-hydrogen-minimum'],
    }

    const qqu: ui.Question = {
      type: 'select',
      name: 'name',
      message: "Your UI extension's working name?",
      default: 'extension',
      choices: ['template-hydrogen-default2222', 'template-hydrogen-minimum2222'],
    }

    const result = await ui.prompt([question, qqu])
    console.log(result)
  }
}
