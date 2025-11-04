import {generateSchemaService} from '../../../services/generate-schema.js'
import {chooseFunction, functionFlags} from '../../../services/function/common.js'
import {appFlags} from '../../../flags.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class FetchSchema extends AppLinkedCommand {
  static summary = 'Fetch the latest GraphQL schema for a function.'

  static descriptionWithMarkdown = `Generates the latest [GraphQL schema](https://shopify.dev/docs/apps/functions/input-output#graphql-schema) for a function in your app. Run this command from the function directory.

  This command uses the API type and version of your function, as defined in your extension TOML file, to generate the latest GraphQL schema. The schema is written to the \`schema.graphql\` file.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
    stdout: Flags.boolean({
      description: 'Output the schema to stdout instead of writing to a file.',
      required: false,
      default: false,
      env: 'SHOPIFY_FLAG_STDOUT',
    }),
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(FetchSchema)

    const {app, developerPlatformClient, organization} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    const ourFunction = await chooseFunction(app, flags.path)

    await generateSchemaService({
      app,
      extension: ourFunction,
      stdout: flags.stdout,
      developerPlatformClient,
      orgId: organization.id,
    })

    return {app}
  }
}
