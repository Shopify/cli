import {submissionFlags} from './flags.js'
import {resolveSubscriptionMigrationClientId} from '../../../services/subscription-migrations/resolve-client-id.js'
import {runSubmissionCommand} from '../../../services/subscription-migrations/run-submission-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'

export default class Schedule extends BaseCommand {
  static summary = 'Schedules manual-billing subscriptions to migrate to Shopify-managed app pricing.'

  static descriptionWithMarkdown = `Schedules manual-billing subscriptions to migrate to Shopify-managed app pricing.

When \`--input\` is omitted, the command reads CSV data from stdin. Use \`--input <path>\` to read from a file. \`--input -\` is also supported as an explicit stdin path.

- Required CSV columns: \`shop_id\`, \`target_plan_handle\`, and \`price_behavior\`.
- Optional CSV column: \`notification\`.
- Example header: \`shop_id,target_plan_handle,price_behavior,notification\`.
- Example row: \`123456789,pro,HONOR_BILLING_PRICE,WHEN_REQUIRED\`.

\`price_behavior\` must be \`HONOR_BILLING_PRICE\` or \`PLAN_PRICE\`. \`notification\` can be \`NONE\`, \`OPT_OUT\`, or \`WHEN_REQUIRED\` and defaults to \`WHEN_REQUIRED\` when omitted or blank.

Validation is atomic: the command submits no operations unless the entire CSV is valid. Valid rows are submitted in batches of 250 shops. Preserve the root idempotency key and every operation GID printed by the command. Reusing the same root idempotency key with the same client ID, action, and input replays the same submission.

By default, the command uses the Client ID from the active app configuration. Use \`--path\` to select an app directory or \`--config\` to select a configuration. Pass \`--client-id\` to explicitly override the active configuration; this only selects the app and does not change Partners authentication.

Use \`--force\` to skip confirmation and immediately submit every valid row. With \`--watch\`, human-readable output shows accepted identifiers before polling begins, then displays operation progress and the final outcome. With \`--json --watch\`, the command outputs one structured JSON document after every operation reaches a terminal status.`

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
    const {flags} = await this.parse(Schedule)

    const clientId = await resolveSubscriptionMigrationClientId({
      clientId: flags['client-id'],
      directory: flags.path,
      configName: flags.config,
    })

    await runSubmissionCommand({
      action: 'schedule',
      input: flags.input ?? '-',
      clientId,
      rootIdempotencyKey: flags['idempotency-key'],
      skipConfirmation: flags.force,
      json: flags.json,
      watch: flags.watch,
    })
  }
}
