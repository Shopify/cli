import {appFlags} from '../../../flags.js'
import {resolveAppSecurityRoot} from '../../../services/app-security-api.js'
import securityClean, {renderSecurityCleanResult} from '../../../services/security-clean.js'
import {securityCleanJsonOutputSchema} from '../../../services/security-clean-json.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'

export default class SecurityClean extends BaseCommand {
  static hidden = true

  static summary = 'Remove local App Security artifacts.'

  static descriptionWithMarkdown = `Deletes the App Security artifacts in \`.shopify/app-security/\` without asking: the scan, the agent checks, the recorded agent findings, the submission payload, and files left by earlier CLI versions. Prints each removed path.`

  static get jsonOutputSchema() {
    return securityCleanJsonOutputSchema
  }

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    path: appFlags.path,
    ...jsonFlag,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(SecurityClean)

    const appRoot = resolveAppSecurityRoot(flags.path)
    const result = await securityClean({appRoot})

    if (flags.json) {
      outputResult(securityCleanJsonOutputSchema.encode(result))
    } else {
      renderSecurityCleanResult(result, appRoot)
    }
  }
}
