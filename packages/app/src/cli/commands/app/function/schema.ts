import {generateSchemaService} from '../../../services/generate-schema.js'
import {functionFlags, inFunctionContext} from '../../../services/function/common.js'
import {showApiKeyDeprecationWarning} from '../../../prompts/deprecation-warnings.js'
import {appFlags} from '../../../flags.js'
import AppCommand, {AppCommandOutput} from '../../../utilities/app-command.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class FetchSchema extends AppCommand {
  static summary = 'Fetch the latest GraphQL schema for a function.'

  static descriptionWithMarkdown = `Generates the latest [GraphQL schema](https://shopify.dev/docs/apps/functions/input-output#graphql-schema) for a function in your app. Run this command from the function directory.

  This command uses the API type and version of your function, as defined in your extension TOML file, to generate the latest GraphQL schema. The schema is written to the \`schema.graphql\` file.`

  static description = this.descriptionWithoutMarkdown()

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

  public async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(FetchSchema)
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }
    const apiKey = flags['client-id'] || flags['api-key']

    const app = await inFunctionContext({
      path: flags.path,
      apiKey,
      userProvidedConfigName: flags.config,
      callback: async (app, developerPlatformClient, ourFunction) => {
        await generateSchemaService({
          app,
          extension: ourFunction,
          developerPlatformClient,
          stdout: flags.stdout,
          path: flags.path,
        })
        return app
      },
    })

    return {app}
  }
}
