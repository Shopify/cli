/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {demo, DemoStep} from '../../services/demo.js'
import Command from '@shopify/cli-kit/node/base-command'
import {readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'
import {fileURLToPath} from 'url'

export default class Catalog extends Command {
  static description = 'Browse the catalog for steps'
  static hidden = true

  async run(): Promise<void> {
    const catalogFile = joinPath(fileURLToPath(import.meta.url), '../../../../../assets/demo-catalog.json')
    const {steps} = JSON.parse(await readFile(catalogFile)) as {steps: DemoStep[]}
    const stepSelection = await renderAutocompletePrompt({
      message: 'Step to display',
      choices: steps.map(({title, type}) => {
        return {
          label: title!,
          value: title!,
          group: type,
        }
      }),
    })
    const selectedStep = steps.find(({title}) => title === stepSelection)!
    outputInfo('The step looks like this:')
    await demo({steps: [selectedStep]})
    outputInfo('JSON for this step:')
    outputInfo(JSON.stringify(selectedStep, null, 2))
  }
}
