import {appSecuritySelectionFlags} from './selection-flags.js'
import {requireResultsDirectory} from '../../../services/app-security-results.js'
import {resolveAppSecuritySelection} from '../../../services/app-security-selection.js'
import securityRecord, {renderSecurityRecordResult} from '../../../services/security-record.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class SecurityRecord extends BaseCommand {
  static hidden = true

  static summary = 'Record agent findings from an app security check.'

  static descriptionWithMarkdown = `Reads a coding agent's complete findings document from stdin, validates it, and replaces \`agent-findings.json\` in the results directory, \`.shopify/app-security/<results key>/\`. The results key is \`--client-id\` when you pass it, and otherwise the name of the app configuration file without \`.toml\`. \`--client-id\` is checked against your Shopify account before anything is read, so it needs you to be logged in.

The document must include a \`scope\` with the \`include_dirs\`, \`excludes\` and \`no_git_ignore\` values of the \`check\` run it describes, exactly as typed. It's recorded as reported and never compared with the scan's files.

The document is recorded all or nothing: if anything is invalid, the command fails with every error, writes nothing, and exits with a non-zero code. With \`--json\`, the errors are listed in the error document's \`details.errors\`. It needs the results directory that \`shopify app security check\` creates.`

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...appSecuritySelectionFlags,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(SecurityRecord)

    const selection = await resolveAppSecuritySelection({
      path: flags.path,
      config: flags.config,
      clientId: flags['client-id'],
      withoutAppConfig: flags['without-app-config'],
      allowPrompts: false,
      validateClientIdFlag: true,
    })
    await requireResultsDirectory(selection, flags.path)
    const result = await securityRecord({selection, path: flags.path})
    renderSecurityRecordResult(result, selection, flags.path)
  }
}
