import {inFunctionContext, functionFlags} from '../../../services/function/common.js'
import {buildFunctionExtension} from '../../../services/build/extension.js'
import {appFlags} from '../../../flags.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export default class FunctionBuild extends AppLinkedCommand {
  static summary = 'Compile a function to wasm.'

  static descriptionWithMarkdown = `Compiles the function in your current directory to WebAssembly (Wasm) for testing purposes.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(FunctionBuild)

    const app = await inFunctionContext({
      path: flags.path,
      userProvidedConfigName: flags.config,
      apiKey: flags['client-id'],
      reset: flags.reset,
      callback: async (app, _, ourFunction) => {
        await buildFunctionExtension(ourFunction, {
          app,
          stdout: process.stdout,
          stderr: process.stderr,
          useTasks: true,
          environment: 'production',
        })
        renderSuccess({headline: 'Function built successfully.'})
        return app
      },
    })
    return {app}
  }
}
