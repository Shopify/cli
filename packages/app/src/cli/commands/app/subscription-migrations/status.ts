import {statusFlags} from './flags.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {outputOperations} from '../../../services/subscription-migrations/command-output.js'
import {getMigrationOperations} from '../../../services/subscription-migrations/get-operations.js'
import {watchMigrationOperations} from '../../../services/subscription-migrations/watch-operations.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'

export default class Status extends AppLinkedCommand {
  static hidden = true
  static summary = 'Checks the status of app subscription migration operations.'

  static descriptionWithMarkdown = `Checks app subscription migration operation status.

Repeat \`--id\` for every operation GID returned by a multi-batch submission. With \`--watch\`, the command displays the current state while polling and outputs the final state after all requested operations reach a terminal status.

\`RUNNING\` means an operation is still processing. \`COMPLETED\` means processing finished, but you must inspect the per-shop results to confirm each outcome. \`FAILED\` means the operation failed, and \`CANCELED\` means cancellation stopped further processing.

Use \`--json\` to output every operation and its per-shop results as structured JSON.

Run the command from an app project. By default, it uses the Client ID from the active app configuration. Use \`--path\` to select an app directory or \`--config\` to select a configuration. Pass \`--client-id\` to select a different app within the project. Use \`--reset\` to relink the app.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --id <operation-id>',
    '<%= config.bin %> <%= command.id %> --path ../my-app --config staging --id <operation-id-1> --id <operation-id-2> --watch',
    '<%= config.bin %> <%= command.id %> --client-id <client-id> --id <operation-id> --json',
  ]

  static flags = {...statusFlags}

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(Status)
    const {app, remoteApp} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })
    const operations = flags.watch
      ? await watchMigrationOperations({clientId: remoteApp.apiKey, operationIds: flags.id})
      : await getMigrationOperations({clientId: remoteApp.apiKey, operationIds: flags.id})
    outputOperations(operations, flags.json)
    return {app}
  }
}
