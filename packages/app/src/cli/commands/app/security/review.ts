import {appSecurityBlockingFlag} from './blocking-flag.js'
import {appSecuritySelectionFlags} from './selection-flags.js'
import securityReview from '../../../services/security-review.js'
import {SUPPRESSION_KINDS} from '../../../services/app-security-suppressions.js'
import {renderSecurityReviewResult} from '../../../services/security-review/result.js'
import {appSecurityReviewJsonOutputSchema} from '../../../services/security-review/types.js'
import {Flags} from '@oclif/core'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class SecurityReview extends BaseCommand {
  static summary = 'Show the combined app security check results.'

  static descriptionWithMarkdown = `Combines the deterministic results (\`deterministic-findings.json\`, written by \`shopify app security check\`) with the recorded agent results (\`agent-findings.json\`, written by \`shopify app security record\`) and shows one view of every check: its findings, status and source. Both files are in the results directory, \`.shopify/app-security/<results key>/\`. \`--client-id\` is checked against your Shopify account before any results are read, so it needs you to be logged in.

The summary shows the scan directories and the scope of the latest scan, and the scope the agent reported. It notes when the agent findings were recorded for a different scope than the latest scan; that doesn't change the exit code.

The agent results are optional. Use \`--check-id\` to narrow the review to specific checks, \`--verbose\` for full reasoning and evidence, and for suppressed and superseded findings in full, and \`--blocking\` to exit with code 1 when a check with findings is at or above a severity. Suppressed findings are always listed with their kind and reason. With \`--json\`, the result always includes every finding in full, and how the entries of \`shopify.app-security.json\` applied.

Every finding has a number, shown before its source, and the summary shows a digest of the results. The numbers count every finding of every check, so \`--check-id\` and \`--verbose\` change which findings are shown, never their numbers, and a number names the same finding until the results files change. To suppress a finding, pass its number to \`--suppress\` with \`--kind\` and \`--reason\`, and the digest to \`--results-digest\` to refuse the suppression if the results changed since you read the number. The command saves an entry to \`shopify.app-security.json\` that matches only that finding, then shows the review with the finding suppressed. Review and commit the file. When the finding is an agent finding that supersedes a deterministic finding of the same check in the same file, \`check --blocking\` still counts the deterministic finding, because it reads no agent results: the output names it, and \`--include-superseded\` suppresses it too, with the same kind and reason.

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
    suppress: Flags.integer({
      description:
        'Suppress the finding with this number: save an entry for it to shopify.app-security.json. Requires --kind and --reason.',
      env: 'SHOPIFY_FLAG_APP_SECURITY_SUPPRESS',
      min: 1,
    }),
    kind: Flags.string({
      description: `Why the finding is suppressed, with --suppress: ${SUPPRESSION_KINDS.join(' or ')}.`,
      env: 'SHOPIFY_FLAG_APP_SECURITY_SUPPRESSION_KIND',
      dependsOn: ['suppress'],
    }),
    reason: Flags.string({
      description: 'The reason for the suppression, with --suppress. It is saved in shopify.app-security.json.',
      env: 'SHOPIFY_FLAG_APP_SECURITY_SUPPRESSION_REASON',
      dependsOn: ['suppress'],
    }),
    'results-digest': Flags.string({
      description:
        'With --suppress, the results digest that the finding number was read with. The suppression is refused if the results changed since.',
      env: 'SHOPIFY_FLAG_APP_SECURITY_RESULTS_DIGEST',
      dependsOn: ['suppress'],
    }),
    'include-superseded': Flags.boolean({
      description:
        "With --suppress, also suppress the superseded deterministic findings of the agent finding's check in the same file, which check --blocking still counts.",
      env: 'SHOPIFY_FLAG_APP_SECURITY_INCLUDE_SUPERSEDED',
      dependsOn: ['suppress'],
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
      ...(flags.suppress === undefined
        ? {}
        : {
            suppress: {
              findingNumber: flags.suppress,
              kind: flags.kind,
              reason: flags.reason,
              resultsDigest: flags['results-digest'],
              includeSuperseded: Boolean(flags['include-superseded']),
            },
          }),
    })
    renderSecurityReviewResult(review, {verbose: Boolean(flags.verbose)}, flags.json ? 'json' : 'text')
  }
}
