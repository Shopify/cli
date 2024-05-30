import {functionFlags, inFunctionContext} from '../../../services/function/common.js'
import {replay} from '../../../services/function/replay.js'
import {appFlags} from '../../../flags.js'
import {showApiKeyDeprecationWarning} from '../../../prompts/deprecation-warnings.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class FunctionReplay extends Command {
  static summary = 'Replays a function locally based on a FunctionRunEvent.'

  static descriptionWithMarkdown = `Runs the function from your current directory for [testing purposes](https://shopify.dev/docs/apps/functions/testing-and-debugging). To learn how you can monitor and debug functions when errors occur, refer to [Shopify Functions error handling](https://shopify.dev/docs/api/functions/errors).`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
    'api-key': Flags.string({
      hidden: true,
      description: "Application's API key that will be exposed at build time.",
      env: 'SHOPIFY_FLAG_API_KEY',
      exclusive: ['config'],
    }),
    'client-id': Flags.string({
      hidden: false,
      description: "Application's Client ID that will be exposed at build time.",
      env: 'SHOPIFY_FLAG_CLIENT_ID',
      exclusive: ['config'],
    }),
    export: Flags.string({
      char: 'e',
      hidden: false,
      description: 'Name of the wasm export to invoke.',
      default: '_start',
      env: 'SHOPIFY_FLAG_EXPORT',
    }),
    json: Flags.boolean({
      char: 'j',
      hidden: false,
      description: 'Log the run result as a JSON object.',
      env: 'SHOPIFY_FLAG_JSON',
    }),
  }

  public async run() {
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
          export: flags.export,
        })
      },
    })
  }
}
