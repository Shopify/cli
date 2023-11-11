/* eslint-disable no-console */
import Command from '@shopify/cli-kit/node/base-command'
import {keypress, renderTextPrompt} from '@shopify/cli-kit/node/ui'

export default class StdinTest extends Command {
  async run(): Promise<void> {
    console.log('1/5: Start')

    const entered = await renderTextPrompt({message: 'Enter anything', allowEmpty: true})
    console.log(`2/5: Press any key (Entered text: ${entered})`)
    await keypress()

    console.log('3/5: Press any key, again')
    await keypress()

    await renderTextPrompt({message: 'Enter anything, again', allowEmpty: true})

    console.log('4/5 Press any key, again')
    await keypress()

    console.log('4/5: End :)')
  }
}
