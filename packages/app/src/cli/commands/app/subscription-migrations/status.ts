import {statusFlags} from './flags.js'
import {outputOperations} from '../../../services/subscription-migrations/command-output.js'
import {getMigrationOperations} from '../../../services/subscription-migrations/get-operations.js'
import {resolveSubscriptionMigrationClientId} from '../../../services/subscription-migrations/resolve-client-id.js'
import {watchMigrationOperations} from '../../../services/subscription-migrations/watch-operations.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'

export default class Status extends BaseCommand {
  static summary = 'Checks the status of app subscription migration operations.'

  static descriptionWithMarkdown = `Checks app subscription migration operation status.

Repeat \`--id\` for every operation GID returned by a multi-batch submission. With \`--watch\`, the command displays the current state while polling and outputs the final state after all requested operations reach a terminal status.

\`RUNNING\` means an operation is still processing. \`COMPLETED\` means processing finished, but you must inspect the per-shop results to confirm each outcome. \`FAILED\` means the operation failed, and \`CANCELED\` means cancellation stopped further processing.

Use \`--json\` to output every operation and its per-shop results as structured JSON.

By default, the command uses the Client ID from the active app configuration. Use \`--path\` to select an app directory or \`--config\` to select a configuration. Pass \`--client-id\` to explicitly override the active configuration; this only selects the app and does not change Partners authentication.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --id <operation-id>',
    '<%= config.bin %> <%= command.id %> --path ../my-app --config staging --id <operation-id-1> --id <operation-id-2> --watch',
    '<%= config.bin %> <%= command.id %> --client-id <client-id> --id <operation-id> --json',
  ]

  static flags = {...statusFlags}

  async run(): Promise<void> {
    const {flags} = await this.parse(Status)
    const clientId = await resolveSubscriptionMigrationClientId({
      clientId: flags['client-id'],
      directory: flags.path,
      configName: flags.config,
    })
    const operations = flags.watch
      ? await watchMigrationOperations({clientId, operationIds: flags.id})
      : await getMigrationOperations({clientId, operationIds: flags.id})
    outputOperations(operations, flags.json)
  }
}
