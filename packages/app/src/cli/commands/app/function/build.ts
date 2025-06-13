import {chooseFunction, functionFlags} from '../../../services/function/common.js'
import {buildFunctionExtension} from '../../../services/build/extension.js'
import {appFlags} from '../../../flags.js'
import AppCommand, {AppCommandOutput} from '../../../utilities/app-command.js'
import {localAppContext} from '../../../services/app-context.js'
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

  public async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(FunctionBuild)

    const app = await localAppContext({
      directory: flags.path,
      userProvidedConfigName: flags.config,
    })

    const ourFunction = await chooseFunction(app, flags.path)

    await buildFunctionExtension(ourFunction, {
      app,
      stdout: process.stdout,
      stderr: process.stderr,
      useTasks: true,
      environment: 'production',
    })
    renderSuccess({headline: 'Function built successfully.'})

    return {app}
  }
}
