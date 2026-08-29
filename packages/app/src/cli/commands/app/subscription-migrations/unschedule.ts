import {submissionFlags} from './flags.js'
import {presentAcceptedMigrationSubmission, presentMigrationSubmissionResult} from './result-presenter.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {runSubmissionCommand} from '../../../services/subscription-migrations/run-submission-command.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'

export default class Unschedule extends AppLinkedCommand {
  static summary = 'Reverses app subscription migrations that are still scheduled.'

  static descriptionWithMarkdown = `Reverses scheduled app subscription migrations that have not migrated yet.

When \`--input\` is omitted, the command reads CSV data from stdin. Use \`--input <path>\` to read from a file. \`--input -\` is also supported as an explicit stdin path.

- Required CSV header: \`shop_id\`.
- Example row: \`123456789\`.

The CSV can contain only the \`shop_id\` header, or it can reuse the complete CSV supplied to \`schedule\`; schedule-only columns are ignored.

Unscheduling is not a rollback after a subscription has migrated. The command validates the entire CSV before sending any mutation. Use \`--force\` to skip confirmation and immediately submit every valid row.

Operations are submitted in batches of 250 shops. Preserve every operation GID printed by the command so you can check or cancel the submitted operations. With \`--watch\`, human-readable output shows accepted identifiers before polling begins, then displays operation progress and the final outcome. With \`--json --watch\`, the command outputs one structured JSON document after every operation reaches a terminal status.

Run the command from an app project. By default, it uses the Client ID from the active app configuration. Use \`--path\` to select an app directory or \`--config\` to select a configuration. Pass \`--client-id\` to select a different app within the project. Use \`--reset\` to relink the app.`

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
    const {flags} = await this.parse(Unschedule)

    const {app, remoteApp} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    const result = await runSubmissionCommand({
      action: 'unschedule',
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
