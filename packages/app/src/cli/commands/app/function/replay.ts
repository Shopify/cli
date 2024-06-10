import {functionFlags, inFunctionContext} from '../../../services/function/common.js'
import {replay} from '../../../services/function/replay.js'
import {appFlags} from '../../../flags.js'
import {showApiKeyDeprecationWarning} from '../../../prompts/deprecation-warnings.js'
import {environmentVariableNames} from '../../../constants.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {getEnvironmentVariables} from '@shopify/cli-kit/node/environment'
import {isTruthy} from '@shopify/cli-kit/node/context/utilities'

export default class FunctionReplay extends Command {
  static hidden = true
  static summary = 'Replays a function run from an app log.'

  static descriptionWithMarkdown = `Runs the function from your current directory for [testing purposes](https://shopify.dev/docs/apps/functions/testing-and-debugging). To learn how you can monitor and debug functions when errors occur, refer to [Shopify Functions error handling](https://shopify.dev/docs/api/functions/errors).`

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
    'client-id': Flags.string({
      hidden: false,
      description: "Application's Client ID",
      env: 'SHOPIFY_FLAG_CLIENT_ID',
      exclusive: ['config'],
    }),
    json: Flags.boolean({
      char: 'j',
      hidden: false,
      description: 'Output the function run result as a JSON object.',
      env: 'SHOPIFY_FLAG_JSON',
    }),
  }

  public async run() {
    const env = getEnvironmentVariables()
    const logPollingEnabled = isTruthy(env[environmentVariableNames.enableAppLogPolling])

    if (!logPollingEnabled) {
      throw new Error(
        'This command is not released yet. You can experiment with it by setting SHOPIFY_CLI_ENABLE_APP_LOG_POLLING=1 in your env.',
      )
    }

    const {flags} = await this.parse(FunctionReplay)
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }
    const apiKey = flags['client-id'] || flags['api-key']

    await inFunctionContext({
      path: flags.path,
      userProvidedConfigName: flags.config,
      callback: async (app, ourFunction) => {
        await replay({
          app,
          extension: ourFunction,
          apiKey,
          stdout: flags.stdout,
          path: flags.path,
          json: flags.json,
        })
      },
    })
  }
}
