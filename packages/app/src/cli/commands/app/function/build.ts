import {inFunctionContext, functionFlags} from '../../../services/function/common.js'
import {buildFunctionExtension} from '../../../services/build/extension.js'
import {appFlags} from '../../../flags.js'
import AppCommand from '../../../utilities/app-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export default class FunctionBuild extends AppCommand {
  static summary = 'Compile a function to wasm.'

  static descriptionWithMarkdown = `Compiles the function in your current directory to WebAssembly (Wasm) for testing purposes.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
  }

  public async run() {
    const {flags} = await this.parse(FunctionBuild)
    await inFunctionContext({
      path: flags.path,
      userProvidedConfigName: flags.config,
      callback: async (app, ourFunction) => {
        await buildFunctionExtension(ourFunction, {
          app,
          stdout: process.stdout,
          stderr: process.stderr,
          useTasks: true,
          environment: 'production',
        })
        renderSuccess({headline: 'Function built successfully.'})
      },
    })
  }
}
