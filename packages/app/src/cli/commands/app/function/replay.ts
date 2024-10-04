import {functionFlags, inFunctionContext} from '../../../services/function/common.js'
import {replay} from '../../../services/function/replay.js'
import {appFlags} from '../../../flags.js'
import {showApiKeyDeprecationWarning} from '../../../prompts/deprecation-warnings.js'
import AppCommand, {AppCommandOutput} from '../../../utilities/app-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class FunctionReplay extends AppCommand {
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
    log: Flags.string({
      char: 'l',
      description:
        'Specifies a log identifier to replay instead of selecting from a list. The identifier is provided in the output of `shopify app dev` and is the suffix of the log file name.',
      env: 'SHOPIFY_FLAG_LOG',
    }),
    json: Flags.boolean({
      char: 'j',
      hidden: false,
      description: 'Output the function run result as a JSON object.',
      env: 'SHOPIFY_FLAG_JSON',
    }),
    watch: Flags.boolean({
      char: 'w',
      hidden: false,
      allowNo: true,
      default: true,
      description: 'Re-run the function when the source code changes.',
      env: 'SHOPIFY_FLAG_WATCH',
    }),
  }

  public async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(FunctionReplay)
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }
    const apiKey = flags['client-id'] || flags['api-key']

    const app = await inFunctionContext({
      path: flags.path,
      userProvidedConfigName: flags.config,
      callback: async (app, ourFunction) => {
        await replay({
          app,
          extension: ourFunction,
          apiKey,
          path: flags.path,
          log: flags.log,
          json: flags.json,
          watch: flags.watch,
        })
        return app
      },
    })
    return {app}
  }
}
