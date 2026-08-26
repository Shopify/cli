import {operationFlags} from './flags.js'
import {presentMigrationCancellationResult} from './result-presenter.js'
import {cancelMigrationOperations} from '../../../services/subscription-migrations/cancel-operations.js'
import {resolveSubscriptionMigrationClientId} from '../../../services/subscription-migrations/resolve-client-id.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'

export default class Cancel extends BaseCommand {
  static summary = 'Cancels app subscription migration operations.'

  static descriptionWithMarkdown = `Cancels app subscription migration operations.

Canceling stops additional unprocessed shops, but does not undo shops that have already been scheduled or migrated. Use \`unschedule\` for reversible schedules.

Repeat \`--id\` to cancel every operation GID returned by a multi-batch submission. Use \`--json\` to output the resulting operation states and per-shop results as structured JSON.

By default, the command uses the Client ID from the active app configuration. Use \`--path\` to select an app directory or \`--config\` to select a configuration. Pass \`--client-id\` to explicitly override the active configuration; this only selects the app and does not change Partners authentication.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --id <operation-id>',
    '<%= config.bin %> <%= command.id %> --path ../my-app --config staging --id <operation-id-1> --id <operation-id-2>',
    '<%= config.bin %> <%= command.id %> --client-id <client-id> --id <operation-id> --json',
  ]

  static flags = {...operationFlags}

  async run(): Promise<void> {
    const {flags} = await this.parse(Cancel)
    const clientId = await resolveSubscriptionMigrationClientId({
      clientId: flags['client-id'],
      directory: flags.path,
      configName: flags.config,
    })
    const result = await cancelMigrationOperations({
      clientId,
      operationIds: flags.id,
    })
    const exitCode = presentMigrationCancellationResult(result, {json: flags.json})
    if (exitCode !== 0) process.exitCode = exitCode
  }
}
