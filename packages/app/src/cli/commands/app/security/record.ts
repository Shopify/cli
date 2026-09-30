import {appFlags} from '../../../flags.js'
import {resolveAppSecurityRoot} from '../../../services/app-security-api.js'
import securityRecord, {renderSecurityRecordResult} from '../../../services/security-record.js'
import {securityRecordJsonOutputSchema} from '../../../services/security-record-json.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'

export default class SecurityRecord extends BaseCommand {
  static hidden = true

  static summary = 'Record agent App Security findings.'

  static descriptionWithMarkdown = `Reads a coding agent's complete findings document from stdin, validates it, and replaces \`.shopify/app-security/agent-findings.json\`.

The document is recorded all or nothing: if anything is invalid, the command fails with every error, writes nothing, and exits with a non-zero code. With \`--json\`, the errors are listed in the error document's \`details.errors\`. It doesn't need a previous \`shopify app security check\` run.`

  static get jsonOutputSchema() {
    return securityRecordJsonOutputSchema
  }

  static description = this.descriptionForHelp()

  // No --config: nothing in record depends on the app configuration.
  static flags = {
    ...globalFlags,
    path: appFlags.path,
    ...jsonFlag,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(SecurityRecord)

    const appRoot = resolveAppSecurityRoot(flags.path)
    const result = await securityRecord({appRoot})

    if (flags.json) {
      outputResult(securityRecordJsonOutputSchema.encode(result))
    } else {
      renderSecurityRecordResult(result)
    }
  }
}
