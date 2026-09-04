import {listFlags} from './flags.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {listMigratableSubscriptions} from '../../../services/subscription-migrations/list-migratable-subscriptions.js'
import {
  assertMigrationListOutputAvailable,
  outputMigrationList,
  validateMigrationListDestination,
} from '../../../services/subscription-migrations/list-output.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'

export default class List extends AppLinkedCommand {
  static hidden = true
  static summary = 'Lists app subscriptions eligible for migration.'

  static descriptionWithMarkdown = `Lists every app subscription eligible for migration, fetching all pages before producing output.

Use \`--output <path>\` to write CSV, or combine \`--json\` \`--output <path>\` to write JSON. With \`--json\` and no output path, the JSON document is written to stdout. The command does not overwrite an existing output file unless \`--force\` is provided.

Use \`--status\` to filter subscriptions by migration status. Supported values are \`UNSCHEDULED\`, \`SCHEDULED\`, and \`MIGRATED\`.

Run the command from an app project. By default, it uses the Client ID from the active app configuration. Use \`--path\` to select an app directory or \`--config\` to select a configuration. Pass \`--client-id\` to select a different app within the project. Use \`--reset\` to relink the app.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --output subscriptions.csv',
    '<%= config.bin %> <%= command.id %> --status SCHEDULED --output scheduled-subscriptions.csv',
    '<%= config.bin %> <%= command.id %> --json',
    '<%= config.bin %> <%= command.id %> --json --output subscriptions.json --force',
    '<%= config.bin %> <%= command.id %> --client-id <client-id> --output subscriptions.csv',
  ]

  static flags = {...listFlags}

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(List)
    validateMigrationListDestination(flags.output, flags.json)
    if (flags.output !== undefined) await assertMigrationListOutputAvailable(flags.output, flags.force)

    const {app, remoteApp} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })
    const subscriptions = await listMigratableSubscriptions({
      clientId: remoteApp.apiKey,
      status: flags.status,
    })
    await outputMigrationList({
      subscriptions,
      json: flags.json,
      output: flags.output,
      force: flags.force,
    })
    return {app}
  }
}
