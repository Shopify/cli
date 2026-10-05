import {appSecuritySelectionFlags} from './selection-flags.js'
import {requireResultsDirectory} from '../../../services/app-security-results.js'
import {resolveAppSecuritySelection} from '../../../services/app-security-selection.js'
import securityRecord, {renderSecurityRecordResult} from '../../../services/security-record.js'
import {securityRecordJsonOutputSchema} from '../../../services/security-record-json.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'

export default class SecurityRecord extends BaseCommand {
  static hidden = true

  static summary = 'Record agent App Security findings.'

  static descriptionWithMarkdown = `Reads a coding agent's complete findings document from stdin, validates it, and replaces \`agent-findings.json\` in the results directory, \`.shopify/app-security/<results key>/\`. The results key is \`--client-id\` when you pass it, and otherwise the name of the app configuration file without \`.toml\`.

The document is recorded all or nothing: if anything is invalid, the command fails with every error, writes nothing, and exits with a non-zero code. With \`--json\`, the errors are listed in the error document's \`details.errors\`. It needs the results directory that \`shopify app security check\` creates.`

  static get jsonOutputSchema() {
    return securityRecordJsonOutputSchema
  }

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
    })
    await requireResultsDirectory(selection)
    const result = await securityRecord({selection})

    if (flags.json) {
      outputResult(securityRecordJsonOutputSchema.encode(result))
    } else {
      renderSecurityRecordResult(result, selection)
    }
  }
}
