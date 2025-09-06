import {chooseFunction, functionFlags} from '../../../services/function/common.js'
import {generateFixture} from '../../../services/function/generate-fixture.js'
import {appFlags} from '../../../flags.js'
import {showApiKeyDeprecationWarning} from '../../../prompts/deprecation-warnings.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class FunctionGenerateFixture extends AppLinkedCommand {
  static summary = 'Generates test files from a function run log.'
  static hidden = true

  static descriptionWithMarkdown = `Prompts users to select a function run log and generates test fixtures from it. These test cases based on real function executions allows users to test the behaviour of their function based on its input and output.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
    log: Flags.string({
      char: 'l',
      description:
        'Specifies a log identifier to generate test files from instead of selecting from a list. The identifier is provided in the output of `shopify app dev` and is the suffix of the log file name.',
      env: 'SHOPIFY_FLAG_LOG',
    }),
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(FunctionGenerateFixture)

    const {app} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    const ourFunction = await chooseFunction(app, flags.path)

    await generateFixture({
      app,
      extension: ourFunction,
      path: flags.path,
      log: flags.log,
    })

    return {app}
  }
}
