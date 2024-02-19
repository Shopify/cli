import {generateSchemaService} from '../../../services/generate-schema.js'
import {functionFlags, inFunctionContext} from '../../../services/function/common.js'
import {showApiKeyDeprecationWarning} from '../../../prompts/deprecation-warnings.js'
import {appFlags} from '../../../flags.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import Command from '@shopify/cli-kit/node/base-command'

export default class FetchSchema extends Command {
  static description = 'Fetch the latest GraphQL schema for a function.'

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
    'api-key': Flags.string({
      hidden: true,
      name: 'API key',
      description: 'The API key to fetch the schema with.',
      env: 'SHOPIFY_FLAG_APP_API_KEY',
      exclusive: ['config'],
    }),
    'client-id': Flags.string({
      hidden: false,
      description: 'The Client ID to fetch the schema with.',
      env: 'SHOPIFY_FLAG_CLIENT_ID',
      exclusive: ['config'],
    }),
    stdout: Flags.boolean({
      description: 'Output the schema to stdout instead of writing to a file.',
      required: false,
      default: false,
      env: 'SHOPIFY_FLAG_STDOUT',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(FetchSchema)
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }
    const apiKey = flags['client-id'] || flags['api-key']

    await inFunctionContext({
      path: flags.path,
      configName: flags.configName,
      callback: async (app, ourFunction) => {
        await generateSchemaService({
          app,
          extension: ourFunction,
          apiKey,
          stdout: flags.stdout,
          path: flags.path,
        })
      },
    })
  }
}
