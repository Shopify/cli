import {listFlags} from './flags.js'
import {migrationListJsonOutputSchema} from '../../../services/subscription-migrations/types.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {
  iterateMigratableSubscriptionPages,
  MigratableSubscriptionsNotFoundError,
} from '../../../services/subscription-migrations/list-migratable-subscriptions.js'
import {outputMigrationList} from '../../../services/subscription-migrations/list-output.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {jsonFlag} from '@shopify/cli-kit/node/cli'
import {AbortError} from '@shopify/cli-kit/node/error'

export default class List extends AppLinkedCommand {
  static hidden = true
  static summary = 'Lists app subscriptions eligible for migration.'

  static descriptionWithMarkdown = `Lists every app subscription eligible for migration.

By default, the command writes CSV to stdout, streaming each page of results as it arrives. If a later page fails, the rows already written remain valid CSV. Use \`--json\` to fetch all pages first and then write a single JSON envelope to stdout. Use shell redirection to save either format, for example \`shopify app subscription-migrations list > subscriptions.csv\` or \`shopify app subscription-migrations list --json > subscriptions.json\`.

Use \`--status\` to filter subscriptions by migration status. Supported values are \`UNSCHEDULED\`, \`SCHEDULED\`, and \`MIGRATED\`.

Run the command from an app project. By default, it uses the Client ID from the active app configuration. Use \`--path\` to select an app directory or \`--config\` to select a configuration. Pass \`--client-id\` to select a different app within the project. Use \`--reset\` to relink the app.`

  static description = this.descriptionForHelp()

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --status SCHEDULED > scheduled-subscriptions.csv',
    '<%= config.bin %> <%= command.id %> --json',
    '<%= config.bin %> <%= command.id %> --json > subscriptions.json',
    '<%= config.bin %> <%= command.id %> --client-id <client-id> > subscriptions.csv',
  ]

  static flags = {...listFlags, ...jsonFlag}

  static get jsonOutputSchema() {
    return migrationListJsonOutputSchema
  }

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(List)
    const {app, remoteApp} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })
    try {
      const pages = iterateMigratableSubscriptionPages({
        clientId: remoteApp.apiKey,
        status: flags.status,
      })
      await outputMigrationList({pages, json: flags.json})
    } catch (error) {
      if (error instanceof MigratableSubscriptionsNotFoundError) throw new AbortError('App not found')
      throw error
    }
    return {app}
  }
}
