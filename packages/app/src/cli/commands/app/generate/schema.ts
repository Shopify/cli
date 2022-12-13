import {generateSchemaService} from '../../../services/generate-schema.js'
import {appFlags} from '../../../flags.js'
import {AppInterface} from '../../../models/app/app.js'
import {load as loadApp} from '../../../models/app/loader.js'
import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {path, error, cli, output} from '@shopify/cli-kit'

export default class GenerateSchema extends Command {
  static description = 'Generates a GraphQL schema for a function'

  static flags = {
    ...cli.globalFlags,
    ...appFlags,
    'api-key': Flags.string({
      name: 'API key',
      description: 'The API key to fetch the schema with.',
      required: false,
      env: 'SHOPIFY_FLAG_APP_API_KEY',
    }),
  }

  static args = [{name: 'function', required: true, description: 'The name of the function to fetch the schema for.'}]

  public async run(): Promise<void> {
    const {flags, args} = await this.parse(GenerateSchema)
    const apiKey = flags['api-key']
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: AppInterface = await loadApp(directory, this.config)
    const extension = app.extensions.function.find((extension) => extension.localIdentifier === args.function)

    if (!extension) {
      const functions = app.extensions.function.map((extension) => extension.localIdentifier).join(', ')

      throw new error.Abort(
        output.content`No function named ${args.function} found in this app.`,
        output.content`Use one of the available functions: ${functions}`,
      )
    }

    output.info(await generateSchemaService({app, extension, apiKey}))
  }
}
