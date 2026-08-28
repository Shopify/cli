import {createKitchenSinkJsonOutput, kitchenSinkJsonOutputSchema} from '../../services/kitchen-sink/json-output.js'
import Command from '@shopify/cli-kit/node/base-command'
import {jsonFlag} from '@shopify/cli-kit/node/cli'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputResult, outputWarn} from '@shopify/cli-kit/node/output'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import {Flags} from '@oclif/core'

export default class KitchenSinkJsonOutput extends Command {
  static descriptionWithMarkdown = 'Exercise command JSON output infrastructure.'
  static description = this.descriptionWithoutMarkdown()
  static hidden = true

  static flags = {
    ...jsonFlag,
    fail: Flags.boolean({
      description: 'Fail with a sample error.',
      env: 'SHOPIFY_FLAG_FAIL',
      default: false,
    }),
  }

  static get jsonOutputSchema() {
    return kitchenSinkJsonOutputSchema
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(KitchenSinkJsonOutput)
    const result = await renderSingleTask({
      title: outputContent`Preparing the sample result`,
      task: async () => createKitchenSinkJsonOutput(),
    })

    if (flags.fail) {
      outputWarn('Failing as requested.')
      throw new AbortError('Sample command failure.')
    }

    outputResult(flags.json ? kitchenSinkJsonOutputSchema.encode(result) : `Prepared ${result.items.length} item.`)
  }
}
