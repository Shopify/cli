import {functionFlags, inFunctionContext, getOrGenerateSchemaPath} from '../../../services/function/common.js'
import {runFunction} from '../../../services/function/runner.js'
import {appFlags} from '../../../flags.js'
import AppCommand, {AppCommandOutput} from '../../../utilities/app-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {renderAutocompletePrompt, isTTY} from '@shopify/cli-kit/node/ui'
import {outputDebug} from '@shopify/cli-kit/node/output'

const DEFAULT_FUNCTION_EXPORT = '_start'

export default class FunctionRun extends AppCommand {
  static summary = 'Run a function locally for testing.'

  static descriptionWithMarkdown = `Runs the function from your current directory for [testing purposes](https://shopify.dev/docs/apps/functions/testing-and-debugging). To learn how you can monitor and debug functions when errors occur, refer to [Shopify Functions error handling](https://shopify.dev/docs/api/functions/errors).`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
    ...jsonFlag,
    input: Flags.string({
      char: 'i',
      description: 'The input JSON to pass to the function. If omitted, standard input is used.',
      env: 'SHOPIFY_FLAG_INPUT',
    }),
    export: Flags.string({
      char: 'e',
      hidden: false,
      description: 'Name of the WebAssembly export to invoke.',
      env: 'SHOPIFY_FLAG_EXPORT',
    }),
  }

  public async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(FunctionRun)
    const app = await inFunctionContext({
      path: flags.path,
      userProvidedConfigName: flags.config,
      apiKey: flags['client-id'],
      reset: flags.reset,
      callback: async (app, developerPlatformClient, ourFunction) => {
        let functionExport = DEFAULT_FUNCTION_EXPORT

        if (flags.export !== undefined) {
          outputDebug(`Using export ${flags.export} from the --export flag.`)
          functionExport = flags.export
        } else if (
          ourFunction.configuration.targeting !== undefined &&
          ourFunction.configuration.targeting.length > 0
        ) {
          const targeting = ourFunction.configuration.targeting

          if (targeting.length > 1 && isTTY({})) {
            const targets = targeting.map((target) => ({
              label: target.target,
              value: target.export || DEFAULT_FUNCTION_EXPORT,
            }))

            functionExport = await renderAutocompletePrompt({
              message: `Which target would you like to execute?`,
              choices: targets,
            })
          } else {
            functionExport = targeting?.[0]?.export || DEFAULT_FUNCTION_EXPORT
            outputDebug(
              `Using export '${functionExport}'. Use the --export flag or an interactive terminal to select a different export.`,
            )
          }
        } else {
          outputDebug(
            `No targeting information found. Using the default export '${functionExport}'. Use the --export flag or an interactive terminal to select a different export.`,
          )
        }

        const inputQueryPath = ourFunction?.configuration.targeting?.[0]?.input_query
        const queryPath = inputQueryPath && `${ourFunction?.directory}/${inputQueryPath}`
        const schemaPath = await getOrGenerateSchemaPath(ourFunction, app, developerPlatformClient)

        await runFunction({
          functionExtension: ourFunction,
          json: flags.json,
          inputPath: flags.input,
          export: functionExport,
          stdin: 'inherit',
          schemaPath,
          queryPath,
        })
        return app
      },
    })

    return {app}
  }
}
