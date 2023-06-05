import {generateSchemaService} from '../../../services/generate-schema.js'
import {functionFlags, inFunctionContext} from '../../../services/function/common.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import Command from '@shopify/cli-kit/node/base-command'

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
    stdout: Flags.boolean({
      description: 'Output the schema to stdout instead of writing to a file.',
      required: false,
      default: false,
      env: 'SHOPIFY_FLAG_STDOUT',
    }),
  }

  public async run(): Promise<void> {
    const {flags, args} = await this.parse(FetchSchema)
    await inFunctionContext(this.config, flags.path, async (app, ourFunction) => {
      await generateSchemaService({
        app,
        extension: ourFunction,
        apiKey: flags['api-key'],
        stdout: flags.stdout,
        path: flags.path,
      })
    })
  }
}
