import {chooseFunction, functionFlags} from '../../../services/function/common.js'
import {testgen} from '../../../services/function/testgen.js'
import {appFlags} from '../../../flags.js'
import {showApiKeyDeprecationWarning} from '../../../prompts/deprecation-warnings.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class FunctionTestgen extends AppLinkedCommand {
  static summary = 'Generates test files from a function run log.'

  static descriptionWithMarkdown = `Prompts users to select a function run log and generates test fixtures from it. These test cases based on real function executions act as an E2E test suite for the function.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
    'api-key': Flags.string({
      hidden: true,
      description: "Application's API key",
      env: 'SHOPIFY_FLAG_API_KEY',
      exclusive: ['config'],
    }),
    log: Flags.string({
      char: 'l',
      description:
        'Specifies a log identifier to generate test files from instead of selecting from a list. The identifier is provided in the output of `shopify app dev` and is the suffix of the log file name.',
      env: 'SHOPIFY_FLAG_LOG',
    }),
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(FunctionTestgen)
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }

    const {app} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'] ?? flags['api-key'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    const ourFunction = await chooseFunction(app, flags.path)

    await testgen({
      app,
      extension: ourFunction,
      path: flags.path,
      log: flags.log,
    })

    return {app}
  }
}
