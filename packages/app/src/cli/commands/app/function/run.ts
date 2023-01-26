import {functionFlags, inFunctionContext} from '../../../services/function/common.js'
import {runFunctionRunner} from '../../../services/function/build.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class FunctionRun extends Command {
  static description = 'Run a Shopify Function locally for testing.'

  static flags = {
    ...globalFlags,
    ...functionFlags,
  }

  public async run() {
    const {flags} = await this.parse(FunctionRun)
    await inFunctionContext(this.config, flags.path, async (_app, ourFunction) => {
      await runFunctionRunner(ourFunction)
    })
  }
}
