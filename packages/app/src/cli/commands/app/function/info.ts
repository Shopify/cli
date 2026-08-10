import {chooseFunction, functionFlags, getOrGenerateSchemaPath} from '../../../services/function/common.js'
import {functionRunnerBinary, downloadBinary} from '../../../services/function/binaries.js'
import {functionInfo} from '../../../services/function/info.js'
import {presentFunctionInfoResult} from '../../../services/function/info-result.js'
import {functionInfoJsonOutputSchema} from '../../../services/function/info-types.js'
import {localAppContext} from '../../../services/app-context.js'
import {appFlags} from '../../../flags.js'
import AppUnlinkedCommand, {AppUnlinkedCommandOutput} from '../../../utilities/app-unlinked-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class FunctionInfo extends AppUnlinkedCommand {
  static summary = 'Print basic information about your function.'

  static get jsonOutputSchema() {
    return functionInfoJsonOutputSchema
  }

  static descriptionWithMarkdown = `The information returned includes the following:

  - The function handle
  - The function name
  - The function API version
  - The targeting configuration
  - The schema path
  - The WASM path
  - The function runner path`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
    ...jsonFlag,
  }

  public async run(): Promise<AppUnlinkedCommandOutput> {
    const {flags} = await this.parse(FunctionInfo)

    const {app} = await localAppContext({
      directory: flags.path,
      userProvidedConfigName: flags.config,
    })

    const ourFunction = await chooseFunction(app, flags.path)
    const functionRunner = functionRunnerBinary()
    await downloadBinary(functionRunner)

    const schemaPath = await getOrGenerateSchemaPath(
      ourFunction,
      flags.path,
      flags['client-id'],
      flags.reset,
      flags.config,
    )

    const result = functionInfo(ourFunction, {
      functionRunnerPath: functionRunner.path,
      schemaPath,
    })

    presentFunctionInfoResult(result, flags.json ? 'json' : 'text')

    return {app}
  }
}
