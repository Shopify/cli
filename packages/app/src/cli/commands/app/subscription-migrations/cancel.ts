import {operationFlags} from './flags.js'
import {presentMigrationCancellationResult} from './result-presenter.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {cancelMigrationOperations} from '../../../services/subscription-migrations/cancel-operations.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'

export default class Cancel extends AppLinkedCommand {
  static summary = 'Cancels app subscription migration operations.'

  static descriptionWithMarkdown = `Cancels app subscription migration operations.

Canceling stops additional unprocessed shops, but does not undo shops that have already been scheduled or migrated. Use \`unschedule\` for reversible schedules.

Repeat \`--id\` to cancel every operation GID returned by a multi-batch submission. Use \`--json\` to output the resulting operation states and per-shop results as structured JSON.

Run the command from an app project. By default, it uses the Client ID from the active app configuration. Use \`--path\` to select an app directory or \`--config\` to select a configuration. Pass \`--client-id\` to select a different app within the project. Use \`--reset\` to relink the app.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --id <operation-id>',
    '<%= config.bin %> <%= command.id %> --path ../my-app --config staging --id <operation-id-1> --id <operation-id-2>',
    '<%= config.bin %> <%= command.id %> --client-id <client-id> --id <operation-id> --json',
  ]

  static flags = {...operationFlags}

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(Cancel)
    const {app, remoteApp} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })
    const result = await cancelMigrationOperations({
      clientId: remoteApp.apiKey,
      operationIds: flags.id,
    })
    const exitCode = presentMigrationCancellationResult(result, {json: flags.json})
    if (exitCode !== 0) process.exitCode = exitCode
    return {app}
  }
}
