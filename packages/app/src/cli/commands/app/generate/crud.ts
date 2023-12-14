import {appFlags} from '../../../flags.js'
import metadata from '../../../metadata.js'
import generateFromLocalTemplate from '../../../services/generateFromLocalTemplate.js'
import {AppSchema} from '../../../models/app/app.js'
import Command from '../../../utilities/app-command.js'
import {loadAppConfiguration} from '../../../models/app/loader.js'
import pluralize from 'pluralize'
import {joinPath, cwd} from '@shopify/cli-kit/node/path'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Args} from '@oclif/core'

export default class AppGenerateCrud extends Command {
  static description = 'Scaffold a CRUD UI.'
  static examples = ['<%= config.bin %> <%= command.id %>']

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  static args = {
    name: Args.string(),
  }

  public static analyticsNameOverride(): string | undefined {
    return 'app generate crud'
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(AppGenerateCrud)
    await metadata.addPublicMetadata(() => ({
      cmd_scaffold_required_auth: true,
      cmd_scaffold_type_owner: '@shopify/app',
    }))

    const {configuration: maybeConfig} = await loadAppConfiguration({
      directory: joinPath(cwd()),
      configName: flags.config,
    })

    const configuration = AppSchema.parse(maybeConfig)

    if (configuration.custom_data?.metaobject_definitions?.length) {
      const metaobjectDefinition = configuration.custom_data.metaobject_definitions.find(
        (definition) => definition.type === `$app:${args.name}`,
      )

      if (!metaobjectDefinition) {
        throw new Error(`Metaobject definition for ${args.name} not found`)
      }

      await generateFromLocalTemplate({
        template: 'crud',
        directory: joinPath(cwd()),
        options: {
          name: metaobjectDefinition.name,
          namePlural: pluralize.plural(metaobjectDefinition.name),
          nameSingular: pluralize.singular(metaobjectDefinition.name),
          metaobject: metaobjectDefinition,
        },
      })
    }
  }
}
