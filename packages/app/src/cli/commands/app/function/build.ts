import {inFunctionContext, functionFlags} from '../../../services/function/common.js'
import {buildFunctionExtension} from '../../../services/build/extension.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export default class FunctionBuild extends Command {
  static description = 'Compile a Function to WASM.'

  static flags = {
    ...globalFlags,
    ...functionFlags,
  }

  public async run() {
    const {flags} = await this.parse(FunctionBuild)
    await inFunctionContext(this.config, flags.path, async (app, ourFunction) => {
      await buildFunctionExtension(ourFunction, {app, stdout: process.stdout, stderr: process.stderr, useTasks: true})
      renderSuccess({headline: 'Function built successfully.'})
    })
  }
}
