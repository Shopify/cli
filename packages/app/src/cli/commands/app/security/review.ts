import {appFlags} from '../../../flags.js'
import securityReview from '../../../services/security-review.js'
import {securityReviewJsonOutputSchema} from '../../../services/security-review-json.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class SecurityReview extends BaseCommand {
  static hidden = true

  static summary = 'Show the stored App Security results.'

  static descriptionWithMarkdown = `Prints the deterministic findings (\`.shopify/app-security/deterministic-findings.json\`) and the recorded agent findings (\`.shopify/app-security/agent-findings.json\`), each with its path and age.

The two files are shown as they are stored. They aren't compared with each other or with the current source files.`

  static get jsonOutputSchema() {
    return securityReviewJsonOutputSchema
  }

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    path: appFlags.path,
    ...jsonFlag,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(SecurityReview)

    await securityReview({directory: flags.path, json: flags.json})
  }
}
