import {submissionFlags} from './flags.js'
import {resolveSubscriptionMigrationClientId} from '../../../services/subscription-migrations/resolve-client-id.js'
import {runSubmissionCommand} from '../../../services/subscription-migrations/run-submission-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'

export default class Unschedule extends BaseCommand {
  static summary = 'Reverses app subscription migrations that are still scheduled.'

  static descriptionWithMarkdown = `Reverses scheduled app subscription migrations that have not migrated yet.

When \`--input\` is omitted, the command reads CSV data from stdin. Use \`--input <path>\` to read from a file. \`--input -\` is also supported as an explicit stdin path.

- Required CSV header: \`shop_id\`.
- Example row: \`123456789\`.

The CSV can contain only the \`shop_id\` header, or it can reuse the complete CSV supplied to \`schedule\`; schedule-only columns are ignored.

Unscheduling is not a rollback after a subscription has migrated. The command validates the entire CSV before sending any mutation. Use \`--force\` to skip confirmation and immediately submit every valid row.

Operations are submitted in batches of 250 shops. Preserve the root idempotency key and every operation GID printed by the command. Reusing the same root idempotency key with the same client ID, action, and input replays the same submission. With \`--watch\`, human-readable output shows accepted identifiers before polling begins, then displays operation progress and the final outcome. With \`--json --watch\`, the command outputs one structured JSON document after every operation reaches a terminal status.

By default, the command uses the Client ID from the active app configuration. Use \`--path\` to select an app directory or \`--config\` to select a configuration. Pass \`--client-id\` to explicitly override the active configuration; this only selects the app and does not change Partners authentication.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --input migrations.csv --force',
    'cat migrations.csv | <%= config.bin %> <%= command.id %> --force',
    '<%= config.bin %> <%= command.id %> --input migrations.csv --path ../my-app --config staging --force --json',
    '<%= config.bin %> <%= command.id %> --input migrations.csv --client-id <client-id> --idempotency-key <root-idempotency-key> --force',
    '<%= config.bin %> <%= command.id %> --input - --force --watch',
  ]

  static flags = {...submissionFlags}

  async run(): Promise<void> {
    const {flags} = await this.parse(Unschedule)

    const clientId = await resolveSubscriptionMigrationClientId({
      clientId: flags['client-id'],
      directory: flags.path,
      configName: flags.config,
    })

    await runSubmissionCommand({
      action: 'unschedule',
      input: flags.input ?? '-',
      clientId,
      rootIdempotencyKey: flags['idempotency-key'],
      skipConfirmation: flags.force,
      json: flags.json,
      watch: flags.watch,
    })
  }
}
