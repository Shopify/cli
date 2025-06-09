import {functionFlags, inFunctionContext} from '../../../services/function/common.js'
import {generateTest} from '../../../services/function/generate-test.js'
import {appFlags} from '../../../flags.js'
import AppCommand, {AppCommandOutput} from '../../../utilities/app-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class FunctionGenerateTest extends AppCommand {
  static summary = 'Generate a test case from a function run log'

  static description = `Generates a test case from a function run log. This allows you to create test files from actual function executions to ensure your function behaves consistently.

The generated test file will be created in the tests/ directory of your function and can be run with the 'shopify app function test' command.`

  static examples = [
    '# Generate a test from a log interactively',
    '<%= config.bin %> <%= command.id %>',
    '',
    '# Generate a test from a specific log',
    '<%= config.bin %> <%= command.id %> --log=abc123',
  ]

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
    log: Flags.string({
      description: 'The log identifier to generate a test from',
      env: 'SHOPIFY_FLAG_LOG',
    }),
  }

  public async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(FunctionGenerateTest)

    const app = await inFunctionContext({
      path: flags.path,
      apiKey: flags['client-id'],
      userProvidedConfigName: flags.config,
      reset: flags.reset,
      callback: async (app, _, ourFunction) => {
        await generateTest({
          app,
          extension: ourFunction,
          log: flags.log,
        })
        return app
      },
    })
    return {app}
  }
}
