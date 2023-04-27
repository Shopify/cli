import {functionFlags, inFunctionContext} from '../../../services/function/common.js'
import {runFunctionRunner} from '../../../services/function/build.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class FunctionRun extends Command {
  static description = 'Run a Function locally for testing.'

  static flags = {
    ...globalFlags,
    ...functionFlags,
    json: Flags.boolean({
      char: 'j',
      hidden: false,
      description: 'Log the run result as a JSON object.',
      env: 'SHOPIFY_FLAG_JSON',
    }),
  }

  public async run() {
    const {flags} = await this.parse(FunctionRun)
    await inFunctionContext(this.config, flags.path, async (_app, ourFunction) => {
      await runFunctionRunner(ourFunction, {json: flags.json})
    })
  }
}
