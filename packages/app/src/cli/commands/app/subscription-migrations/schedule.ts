import {submissionFlags} from './flags.js'
import {presentAcceptedMigrationSubmission, presentMigrationSubmissionResult} from './result-presenter.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {runSubmissionCommand} from '../../../services/subscription-migrations/run-submission-command.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'

export default class Schedule extends AppLinkedCommand {
  static hidden = true
  static summary = 'Schedules manual-billing subscriptions to migrate to Shopify-managed app pricing.'

  static descriptionWithMarkdown = `Schedules manual-billing subscriptions to migrate to Shopify-managed app pricing.

When \`--input\` is omitted, the command reads CSV data from stdin. Use \`--input <path>\` to read from a file. \`--input -\` is also supported as an explicit stdin path.

- Required CSV columns: \`shop_id\`, \`target_plan_handle\`, and \`price_behavior\`.
- Optional CSV column: \`notification\`.
- Example header: \`shop_id,target_plan_handle,price_behavior,notification\`.
- Example row: \`123456789,pro,HONOR_BILLING_PRICE,WHEN_REQUIRED\`.

\`price_behavior\` must be \`HONOR_BILLING_PRICE\` or \`PLAN_PRICE\`. \`notification\` can be \`NONE\`, \`OPT_OUT\`, or \`WHEN_REQUIRED\` and defaults to \`WHEN_REQUIRED\` when omitted or blank.

Validation is atomic: the command submits no operations unless the entire CSV is valid. Valid rows are submitted in batches of 250 shops. Preserve every operation GID printed by the command so you can check or cancel the submitted operations.

Run the command from an app project. By default, it uses the Client ID from the active app configuration. Use \`--path\` to select an app directory or \`--config\` to select a configuration. Pass \`--client-id\` to select a different app within the project. Use \`--reset\` to relink the app.

Use \`--force\` to skip confirmation and immediately submit every valid row. With \`--watch\`, human-readable output shows accepted identifiers before polling begins, then displays operation progress and the final outcome. With \`--json --watch\`, the command outputs one structured JSON document after every operation reaches a terminal status.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --input migrations.csv --force',
    'cat migrations.csv | <%= config.bin %> <%= command.id %> --force',
    '<%= config.bin %> <%= command.id %> --input migrations.csv --path ../my-app --config staging --force --json',
    '<%= config.bin %> <%= command.id %> --input migrations.csv --client-id <client-id> --force',
    '<%= config.bin %> <%= command.id %> --input - --force --watch',
  ]

  static flags = {...submissionFlags}

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(Schedule)

    const {app, remoteApp} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    const result = await runSubmissionCommand({
      action: 'schedule',
      input: flags.input ?? '-',
      clientId: remoteApp.apiKey,
      skipConfirmation: flags.force,
      watch: flags.watch,
      ...(flags.watch && !flags.json ? {onSubmissionAccepted: presentAcceptedMigrationSubmission} : {}),
    })
    const exitCode = presentMigrationSubmissionResult(result, {json: flags.json, watch: flags.watch})
    if (exitCode !== 0) process.exitCode = exitCode
    return {app}
  }
}
