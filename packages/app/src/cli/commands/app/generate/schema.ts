import {generateSchemaService} from '../../../services/generate-schema.js'
import {appFlags} from '../../../flags.js'
import {AppInterface} from '../../../models/app/app.js'
import {load as loadApp} from '../../../models/app/loader.js'
import {loadExtensionsSpecifications} from '../../../models/extensions/specifications.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import Command from '@shopify/cli-kit/node/base-command'
import * as output from '@shopify/cli-kit/node/output'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'

export default class GenerateSchema extends Command {
  static description = 'Generates a GraphQL schema for a function.'

  static flags = {
    ...globalFlags,
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
    const directory = flags.path ? resolvePath(flags.path) : cwd()
    const specifications = await loadExtensionsSpecifications(this.config)
    const app: AppInterface = await loadApp({directory, specifications})
    const extension = app.extensions.function.find((extension) => extension.localIdentifier === args.function)

    if (!extension) {
      const functions = app.extensions.function.map((extension) => extension.localIdentifier).join(', ')

      throw new AbortError(
        output.outputContent`No function named ${args.function} found in this app.`,
        output.outputContent`Use one of the available functions: ${functions}`,
      )
    }

    output.outputInfo(await generateSchemaService({app, extension, apiKey}))
  }
}
