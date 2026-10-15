import {chooseFunction, functionFlags} from '../../../services/function/common.js'
import {buildFunctionExtension} from '../../../services/build/extension.js'
import {functionBuildJsonOutputSchema} from '../../../services/function/build-command/types.js'
import {renderFunctionBuildResult} from '../../../services/function/build-command/result.js'
import {appFlags} from '../../../flags.js'
import AppUnlinkedCommand, {AppUnlinkedCommandOutput} from '../../../utilities/app-unlinked-command.js'
import {localAppContext} from '../../../services/app-context.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {renderConcurrent} from '@shopify/cli-kit/node/ui'
import {Writable} from 'stream'

export default class FunctionBuild extends AppUnlinkedCommand {
  static get jsonOutputSchema() {
    return functionBuildJsonOutputSchema
  }

  static summary = 'Compile a function to wasm.'

  static descriptionWithMarkdown = `Compiles the function in your current directory to WebAssembly (Wasm) for testing purposes.`

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
    ...jsonFlag,
  }

  public async run(): Promise<AppUnlinkedCommandOutput> {
    const {flags} = await this.parse(FunctionBuild)

    const {app} = await localAppContext({
      directory: flags.path,
      userProvidedConfigName: flags.config,
    })

    const ourFunction = await chooseFunction(app, flags.path)

    const execute = async (stdout: Writable, stderr: Writable) => {
      const result = await buildFunctionExtension(ourFunction, {
        app,
        stdout,
        stderr,
        useTasks: true,
        environment: 'production',
      })
      renderFunctionBuildResult(result, flags.json)
    }
    if (flags.json) {
      await renderConcurrent({
        processes: [{prefix: ourFunction.localIdentifier, action: execute}],
        showTimestamps: false,
      })
    } else {
      await execute(process.stdout, process.stderr)
    }

    return {app}
  }
}
