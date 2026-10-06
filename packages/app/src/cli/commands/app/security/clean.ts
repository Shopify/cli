import {appSecurityCleanSelectionFlags} from './selection-flags.js'
import {requireResultsDirectory} from '../../../services/app-security-results.js'
import {resolveAppDirectory, resolveAppSecuritySelection} from '../../../services/app-security-selection.js'
import securityClean, {renderSecurityCleanResult} from '../../../services/security-clean.js'
import {Flags} from '@oclif/core'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class SecurityClean extends BaseCommand {
  static hidden = true

  static summary = 'Remove local app security check results.'

  static descriptionWithMarkdown = `Deletes the results directory, \`.shopify/app-security/<results key>/\`, without asking. The results key is \`--client-id\` when you pass it, and otherwise the name of the app configuration file without \`.toml\`. Other results directories are left alone. Prints each removed path.

Use \`--all\` to delete every results directory under \`.shopify/app-security/\` instead. \`--all\` takes neither \`--config\` nor \`--client-id\`, and with \`--without-app-config\` it doesn't need \`--client-id\`.`

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...appSecurityCleanSelectionFlags,
    // Destructive: must be typed, never inherited from the environment.
    // eslint-disable-next-line @shopify/cli/command-flags-with-env
    all: Flags.boolean({
      description: 'Delete every results directory under .shopify/app-security/, not only the selected one.',
      exclusive: ['config', 'client-id'],
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(SecurityClean)

    const selectionOptions = {
      path: flags.path,
      config: flags.config,
      clientId: flags['client-id'],
      withoutAppConfig: flags['without-app-config'],
    }
    const options = flags.all
      ? {all: true as const, appDirectory: await resolveAppDirectory(selectionOptions)}
      : {all: false as const, selection: await resolveAppSecuritySelection({...selectionOptions, allowPrompts: false})}
    if (!options.all) await requireResultsDirectory(options.selection, flags.path)

    const result = await securityClean(options)
    const appDirectory = options.all ? options.appDirectory : options.selection.appDirectory
    renderSecurityCleanResult(result, appDirectory)
  }
}
