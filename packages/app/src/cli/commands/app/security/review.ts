import {appSecurityBlockingFlag} from './blocking-flag.js'
import {appSecuritySelectionFlags} from './selection-flags.js'
import securityReview from '../../../services/security-review.js'
import {renderSecurityReviewResult} from '../../../services/security-review/result.js'
import {appSecurityReviewJsonOutputSchema} from '../../../services/security-review/types.js'
import {Flags} from '@oclif/core'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class SecurityReview extends BaseCommand {
  static summary = 'Show the combined app security check results.'

  static descriptionWithMarkdown = `Combines the deterministic results (\`deterministic-findings.json\`, written by \`shopify app security check\`) with the recorded agent results (\`agent-findings.json\`, written by \`shopify app security record\`) and shows one view of every check: its findings, status and source. Both files are in the results directory, \`.shopify/app-security/<results key>/\`. \`--client-id\` is checked against your Shopify account before any results are read, so it needs you to be logged in.

The summary shows the scan directories and the scope of the latest scan, and the scope the agent reported. It notes when the agent findings were recorded for a different scope than the latest scan; that doesn't change the exit code.

The agent results are optional. Use \`--check-id\` to narrow the review to specific checks, \`--verbose\` for full reasoning, evidence and suppressed findings, and \`--blocking\` to exit with code 1 when a check with findings is at or above a severity. Add \`--fail-on-unresolved\` to also exit with code 1 when a check is unresolved or has no result. With \`--json\`, the result always includes every finding in full.

Use \`--sarif\` to print the reviewed checks as a [SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html) log instead of the review, for GitHub code scanning and other tools that read SARIF. Only the log goes to stdout, so redirect it to save it to a file: \`shopify app security review --sarif > app-security.sarif\`. Warnings go to stderr. Each check is a rule and each active finding a result, with an error, warning, or note level for a high, medium, or low severity. Suppressed and superseded findings are left out: GitHub code scanning ignores SARIF suppressions and would open alerts for them, so instead an open alert closes as fixed once its finding is suppressed. Unresolved and not applicable checks, checks with no result in either results file, and coverage gaps are listed as tool execution notifications, and the execution is marked unsuccessful when a check is unresolved or has no result, or there's no results file. A check with no result has no rule. File locations are absolute \`file:\` URIs, which GitHub's \`upload-sarif\` action makes relative to the repository.

Code scanning replaces the previous analysis of the same category on each upload, and closes the alerts that are missing from it as fixed. A check without results reads as passing, so an upload with unresolved checks, checks with no result, or no results file closes alerts that may still be open; a warning says when that's the case. Have your coding agent record its findings before you upload the log. With \`--fail-on-unresolved\`, the review exits with code 1 when a check is unresolved or has no result, so the pipeline can stop before the upload. The log holds the same checks as the review, so \`--check-id\` narrows it too, and gives it a category of its own: \`automationDetails.id\` is \`shopify-app-security/check-id/<IDs>/client-id/<client ID>/\`, with the sorted check IDs separated by commas, and without the client ID part when the app has none, so a narrowed upload leaves the alerts of a full one, and of other apps, open. That ID takes precedence over the \`category\` input of \`upload-sarif\`. A full run has no \`automationDetails\`, so \`category\` sets it.

Reports the number of findings to Shopify as usage telemetry, but not finding details. See [usage reporting](https://shopify.dev/docs/api/shopify-cli#usage-reporting) for details.`

  static jsonOutputSchema = appSecurityReviewJsonOutputSchema

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...appSecuritySelectionFlags,
    'check-id': Flags.string({
      description: 'Show only this check. Repeat the flag to show several checks.',
      env: 'SHOPIFY_FLAG_CHECK_ID',
      multiple: true,
    }),
    ...appSecurityBlockingFlag,
    'fail-on-unresolved': Flags.boolean({
      description: 'Exit with code 1 when a reviewed check is unresolved or has no result, whatever --blocking is.',
      env: 'SHOPIFY_FLAG_APP_SECURITY_FAIL_ON_UNRESOLVED',
      default: false,
    }),
    sarif: Flags.boolean({
      description:
        'Print the reviewed checks as SARIF 2.1.0 instead of the review, for code scanning tools. Redirect the output to save it to a file.',
      default: false,
      exclusive: ['json'],
      env: 'SHOPIFY_FLAG_APP_SECURITY_SARIF',
    }),
    ...jsonFlag,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(SecurityReview)

    const review = await securityReview({
      directory: flags.path,
      configName: flags.config,
      clientId: flags['client-id'],
      withoutAppConfig: Boolean(flags['without-app-config']),
      checkIds: flags['check-id'] ?? [],
      blocking: flags.blocking,
      failOnUnresolved: Boolean(flags['fail-on-unresolved']),
    })
    renderSecurityReviewResult(review, {verbose: Boolean(flags.verbose)}, outputFormat(flags))
  }
}

function outputFormat(flags: {json?: boolean; sarif: boolean}): 'json' | 'sarif' | 'text' {
  if (flags.json) return 'json'
  return flags.sarif ? 'sarif' : 'text'
}
