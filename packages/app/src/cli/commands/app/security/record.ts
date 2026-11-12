import {appSecuritySelectionFlags} from './selection-flags.js'
import {requireResultsDirectory} from '../../../services/app-security-results.js'
import {resolveAppSecuritySelection} from '../../../services/app-security-selection.js'
import securityRecord from '../../../services/security-record.js'
import {renderSecurityRecordResult} from '../../../services/security-record/result.js'
import {appSecurityRecordJsonOutputSchema} from '../../../services/security-record/types.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class SecurityRecord extends BaseCommand {
  static summary = 'Record agent findings from an app security check.'

  static descriptionWithMarkdown = `Reads a coding agent's complete findings document from stdin, validates it, and replaces \`agent-findings.json\` in the results directory, \`.shopify/app-security/<results key>/\`. The results key is \`--client-id\` when you pass it, and otherwise the name of the app configuration file without \`.toml\`. \`--client-id\` is checked against your Shopify account before anything is read, so it needs you to be logged in.

The document must include a \`scope\` with the \`include_dirs\`, \`excludes\` and \`no_git_ignore\` values of the \`check\` run it describes, exactly as typed. It's recorded as reported and never compared with the scan's files.

Each finding is stored with the redacted lines of code that it cites, read from the cited files that \`check\` scans with that scope: files in the app directory and its extension and web directories, and in the \`--include-dir\` directories that the latest \`check\` recorded when its \`include_dirs\` are the same. Files that \`--exclude\` or Git ignores and files in \`.git\` are never read, and binary files and files that hold secrets, such as \`.env\`, are never quoted. When the lines would make \`agent-findings.json\` larger than 5 MB, it's written without them and the command warns.

The document is recorded all or nothing: if anything is invalid, the command fails with every error, writes nothing, and exits with a non-zero code. It needs the results directory that \`shopify app security check\` creates.

Reports the number of findings to Shopify as usage telemetry, but not finding details. See [usage reporting](https://shopify.dev/docs/api/shopify-cli#usage-reporting) for details.`

  static jsonOutputSchema = appSecurityRecordJsonOutputSchema

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...appSecuritySelectionFlags,
    ...jsonFlag,
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
    const options = {selection, path: flags.path}
    const result = await securityRecord(options)
    renderSecurityRecordResult(result, options, flags.json ? 'json' : 'text')
  }
}
