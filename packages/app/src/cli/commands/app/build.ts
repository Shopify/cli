import {Command} from '@oclif/core'
import {session, ui} from '@shopify/cli-kit'
import {Prompt, Select, MultiSelect, prompt} from 'enquirer'
// import * as colors from 'ansi-colors'

export default class Build extends Command {
  static description = 'Build a block or an app'

  async run(): Promise<void> {
    // const question: ui.Question = {
    //   type: 'select',
    //   name: 'template',
    //   message: 'Choose a template',
    //   choices: ['template-hydrogen-default', 'template-hydrogen-minimum'],
    // }

    // const result = await ui.prompt([question])
    // console.log(result)

    const result = await ui.promptSelect()
    console.log(result)

    // const prompt1 = new Select({
    //   name: 'color',
    //   message: 'Pick a flavor',
    //   choices: ['apple', 'grape', 'watermelon', 'cherry', 'orange'],
    // })

    // const prompt2 = new Select({
    //   name: 'color',
    //   message: 'Pick a flavor',
    //   choices: ['apple', 'grape', 'watermelon', 'cherry', 'orange'],
    // })

    // // prompt
    // //   .run()
    // //   .then((answer) => console.log('Answer:', answer))
    // //   .catch(console.error)

    // const a = prompt1.run()

    // console.log(a)
    // const token: session.OAuthSession = await session.ensureAuthenticated({})
    // console.log('TOKEN:', token)
    // await session.ensureAuthenticated({})
  }
}
