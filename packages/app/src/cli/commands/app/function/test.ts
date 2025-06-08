import {functionFlags, inFunctionContext, getOrGenerateSchemaPath} from '../../../services/function/common.js'
import {functionTest, checkIfTestFilesHaveExports} from '../../../services/function/test.js'
import {appFlags} from '../../../flags.js'
import AppCommand, {AppCommandOutput} from '../../../utilities/app-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {renderAutocompletePrompt, isTTY} from '@shopify/cli-kit/node/ui'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'

const DEFAULT_FUNCTION_EXPORT = '_start'

export default class FunctionTest extends AppCommand {
  static summary = 'Run function tests.'

  static descriptionWithMarkdown = `Runs tests for the function in your current directory. Tests are discovered from JSON files in the \`tests\` directory within your function. Each test can specify its own export, or you can use the --export flag as a default.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
    export: Flags.string({
      char: 'e',
      hidden: false,
      description: 'Default WebAssembly export to invoke (can be overridden per test).',
      env: 'SHOPIFY_FLAG_EXPORT',
    }),
    'test-file': Flags.string({
      char: 't',
      description: 'Run a specific test file instead of all tests.',
      env: 'SHOPIFY_FLAG_TEST_FILE',
    }),
  }

  public async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(FunctionTest)

    const app = await inFunctionContext({
      path: flags.path,
      userProvidedConfigName: flags.config,
      apiKey: flags['client-id'],
      reset: flags.reset,
      callback: async (app, developerPlatformClient, ourFunction, orgId) => {
        let functionExport = DEFAULT_FUNCTION_EXPORT

        if (flags.export !== undefined) {
          outputDebug(`Using export ${flags.export} from the --export flag.`)
          functionExport = flags.export
        } else if (
          ourFunction.configuration.targeting !== undefined &&
          ourFunction.configuration.targeting.length > 0
        ) {
          const targeting = ourFunction.configuration.targeting

          // Check if test files have their own exports specified
          const testsPath = joinPath(ourFunction.directory, 'tests')
          const testFilesHaveExports = await checkIfTestFilesHaveExports(testsPath, flags['test-file'])

          if (targeting.length > 1 && isTTY({}) && !testFilesHaveExports) {
            const targets = targeting.map((target) => ({
              label: target.target,
              value: target.export ?? DEFAULT_FUNCTION_EXPORT,
            }))

            functionExport = await renderAutocompletePrompt({
              message: `Which target would you like to execute?`,
              choices: targets,
            })
          } else {
            functionExport = targeting?.[0]?.export ?? DEFAULT_FUNCTION_EXPORT
            if (testFilesHaveExports) {
              outputDebug(
                `Using export '${functionExport}' as default. Test files may override with their own export specifications.`,
              )
            } else {
              outputDebug(
                `Using export '${functionExport}'. Use the --export flag or an interactive terminal to select a different export.`,
              )
            }
          }
        } else {
          outputDebug(
            `No targeting information found. Using the default export '${functionExport}'. Use the --export flag or an interactive terminal to select a different export.`,
          )
        }

        const inputQueryPath = ourFunction?.configuration.targeting?.[0]?.input_query
        const queryPath = inputQueryPath && `${ourFunction?.directory}/${inputQueryPath}`
        const schemaPath = await getOrGenerateSchemaPath(ourFunction, app, developerPlatformClient, orgId)

        await functionTest({
          functionExtension: ourFunction,
          export: functionExport,
          schemaPath,
          queryPath,
          testFile: flags['test-file'],
        })

        return app
      },
    })

    return {app}
  }
}
