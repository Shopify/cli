import {chooseFunction, functionFlags, getOrGenerateSchemaPath} from '../../../services/function/common.js'
import {functionRunnerBinary, downloadBinary} from '../../../services/function/binaries.js'
import {localAppContext} from '../../../services/app-context.js'
import {appFlags} from '../../../flags.js'
import AppUnlinkedCommand, {AppUnlinkedCommandOutput} from '../../../utilities/app-unlinked-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'

export default class FunctionInfo extends AppUnlinkedCommand {
  static summary = 'Get information about the function.'

  static description = 'Returns information about the function.'

  static hidden = true

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
    ...jsonFlag,
  }

  public async run(): Promise<AppUnlinkedCommandOutput> {
    const {flags} = await this.parse(FunctionInfo)

    const app = await localAppContext({
      directory: flags.path,
      userProvidedConfigName: flags.config,
    })

    const ourFunction = await chooseFunction(app, flags.path)
    const functionRunner = functionRunnerBinary()
    await downloadBinary(functionRunner)

    const inputQueryPath = ourFunction?.configuration.targeting?.[0]?.input_query
    const queryPath = inputQueryPath && `${ourFunction?.directory}/${inputQueryPath}`
    const schemaPath = await getOrGenerateSchemaPath(
      ourFunction,
      flags.path,
      flags['client-id'],
      flags.reset,
      flags.config,
    )

    if (flags.json) {
      outputResult(
        JSON.stringify({
          functionRunnerPath: functionRunner.path,
          functionInputQueryPath: queryPath,
          functionSchemaPath: schemaPath,
          functionWasmPath: ourFunction.outputPath,
        }),
      )
    } else {
      outputResult(`functionRunnerPath: ${functionRunner.path}`)
      outputResult(`functionInputQueryPath: ${queryPath}`)
      outputResult(`functionSchemaPath: ${schemaPath}`)
      outputResult(`functionWasmPath: ${ourFunction.outputPath}`)
    }

    return {app}
  }
}
