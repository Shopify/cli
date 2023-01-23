import {generateSchemaService} from '../../../services/generate-schema.js'
import {AppInterface} from '../../../models/app/app.js'
import {load as loadApp} from '../../../models/app/loader.js'
import {loadExtensionsSpecifications} from '../../../models/extensions/specifications.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {AbortError} from '@shopify/cli-kit/node/error'
import Command from '@shopify/cli-kit/node/base-command'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'
import {renderFatalError} from '@shopify/cli-kit/node/ui'
import {output} from '@shopify/cli-kit'

export default class PullSchema extends Command {
  static description = 'Pulls the latest GraphQL schema. Currently used for Functions.'

  static flags = {
    ...globalFlags,
    path: Flags.string({
      hidden: false,
      description: 'The path to your function directory.',
      parse: (input, _) => Promise.resolve(resolvePath(input)),
      env: 'SHOPIFY_FLAG_PATH',
    }),
    'api-key': Flags.string({
      name: 'API key',
      description: 'The API key to use.',
      required: false,
      env: 'SHOPIFY_FLAG_APP_API_KEY',
    }),
  }

  public async run(): Promise<void> {
    const {flags, args} = await this.parse(PullSchema)
    const apiKey = flags['api-key']
    const directory = flags.path ? resolvePath(flags.path) : cwd()
    const specifications = await loadExtensionsSpecifications(this.config)
    const app: AppInterface = await loadApp({directory, specifications})

    const ourFunction = app.extensions.function.find((fun) => fun.directory === directory)
    if (!ourFunction) {
      return renderFatalError(
        new AbortError('Run this command from a function directory or use the `--path` flag to specify a function.'),
      )
    }

    output.info(await generateSchemaService({app, extension: ourFunction, apiKey}))
  }
}
