import {appSecurityBlockingFlag} from './blocking-flag.js'
import {appSecuritySelectionFlags} from './selection-flags.js'
import securityReview from '../../../services/security-review.js'
import {securityReviewJsonOutputSchema} from '../../../services/security-review-json.js'
import {Flags} from '@oclif/core'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class SecurityReview extends BaseCommand {
  static hidden = true

  static summary = 'Show the combined app security check results.'

  static descriptionWithMarkdown = `Combines the deterministic results (\`deterministic-findings.json\`, written by \`shopify app security check\`) with the recorded agent results (\`agent-findings.json\`, written by \`shopify app security record\`) and shows one view of every check: its findings, status and source. Both files are in the results directory, \`.shopify/app-security/<results key>/\`.

The summary shows the scan directories and the scope of the latest scan, and the scope the agent reported. It notes when the agent findings were recorded for a different scope than the latest scan; that doesn't change the exit code.

The agent results are optional. Use \`--check-id\` to narrow the review to specific checks, \`--verbose\` for full reasoning, evidence and suppressed findings, and \`--blocking\` to exit with code 1 when a check with findings is at or above a severity.`

  static get jsonOutputSchema() {
    return securityReviewJsonOutputSchema
  }

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...appSecuritySelectionFlags,
    ...jsonFlag,
    'check-id': Flags.string({
      description: 'Show only this check. Repeat the flag to show several checks.',
      env: 'SHOPIFY_FLAG_CHECK_ID',
      multiple: true,
    }),
    ...appSecurityBlockingFlag,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(SecurityReview)

    await securityReview({
      directory: flags.path,
      configName: flags.config,
      clientId: flags['client-id'],
      withoutAppConfig: Boolean(flags['without-app-config']),
      json: flags.json,
      verbose: Boolean(flags.verbose),
      checkIds: flags['check-id'] ?? [],
      blocking: flags.blocking,
    })
  }
}
