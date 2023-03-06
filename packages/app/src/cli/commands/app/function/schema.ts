import {generateSchemaService} from '../../../services/generate-schema.js'
import {functionFlags, inFunctionContext} from '../../../services/function/common.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import Command from '@shopify/cli-kit/node/base-command'
import {outputInfo} from '@shopify/cli-kit/node/output'

export default class FetchSchema extends Command {
  static description = 'Fetch the latest GraphQL schema for a Function.'

  static flags = {
    ...globalFlags,
    ...functionFlags,
    'api-key': Flags.string({
      name: 'API key',
      description: 'The API key to fetch the schema with.',
      required: false,
      env: 'SHOPIFY_FLAG_APP_API_KEY',
    }),
  }

  public async run(): Promise<void> {
    const {flags, args} = await this.parse(FetchSchema)
    await inFunctionContext(this.config, flags.path, async (app, ourFunction) => {
      outputInfo(await generateSchemaService({app, extension: ourFunction, apiKey: flags['api-key']}))
    })
  }
}
