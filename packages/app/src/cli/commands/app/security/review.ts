import {appSecurityBlockingFlag} from './blocking-flag.js'
import {appSecuritySelectionFlags} from './selection-flags.js'
import securityReview from '../../../services/security-review.js'
import {SUPPRESSION_KINDS} from '../../../services/app-security-suppressions.js'
import {interactiveSecurityReview} from '../../../services/security-review-interactive.js'
import {renderSecurityReviewResult} from '../../../services/security-review/result.js'
import {appSecurityReviewJsonOutputSchema} from '../../../services/security-review/types.js'
import {Flags} from '@oclif/core'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class SecurityReview extends BaseCommand {
  static summary = 'Show the combined app security check results.'

  static descriptionWithMarkdown = `Combines the deterministic results (\`deterministic-findings.json\`, written by \`shopify app security check\`) with the recorded agent results (\`agent-findings.json\`, written by \`shopify app security record\`) and shows one view of every check: its findings, status and source. Both files are in the results directory, \`.shopify/app-security/<results key>/\`. \`--client-id\` is checked against your Shopify account before any results are read, so it needs you to be logged in.

The summary shows the scan directories and the scope of the latest scan, and the scope the agent reported. It notes when the agent findings were recorded for a different scope than the latest scan; that doesn't change the exit code.

The agent results are optional. Use \`--check-id\` to narrow the review to specific checks, \`--verbose\` for full reasoning and evidence, and for suppressed and superseded findings in full, and \`--blocking\` to exit with code 1 when a check with active findings is at or above a severity. With \`--json\`, the result always includes every finding in full, and how the entries of \`shopify.app-security.json\` applied.

\`shopify.app-security.json\`, in the app directory, holds the findings that your team decided not to fix. Commit it, so that your team and CI use the same decisions. Each entry names a finding's source, check ID and file, and can name a \`code\` text of the finding. It has a kind, \`false-positive\` or \`accepted-risk\`, a reason, which is required. Suppressions apply to all app configurations and client-ID runs. A finding that an entry matches is suppressed: it doesn't count for \`--blocking\`, and it's always listed with its kind and reason. Findings that the agent suppressed, and superseded deterministic findings, which a check's prefer-agent agent result replaces, don't count either. An entry's \`code\` matches the code excerpt that the results file saved with the finding. A results file that would be larger than 5 MB with excerpts is saved without them, and results written before excerpts existed have none; then an entry with \`code\` matches only the finding's message. An entry that matches no finding is stale, and an entry whose code matches more than one finding is ambiguous. Neither suppresses anything, and the review lists both, so you can remove or update them. Entries for checks without an executed result aren't evaluated. An invalid file makes the command fail with every problem.

Every finding has a number, shown before its source, and the summary shows a digest of the results. The numbers count every finding of every check, so \`--check-id\` and \`--verbose\` change which findings are shown, never their numbers, and a number names the same finding until the results files change. To suppress a finding, pass its number to \`--suppress\` with \`--kind\` and \`--reason\`, and the digest to \`--results-digest\` to refuse the suppression if the results changed since you read the number. The command saves an entry to \`shopify.app-security.json\` that matches only that finding, then shows the review with the finding suppressed. Review and commit the file. When the finding is an agent finding that supersedes a deterministic finding of the same check in the same file, \`check --blocking\` still counts the deterministic finding, because it reads no agent results: the output names it, and \`--include-superseded\` suppresses it too, with the same kind and reason.

Use \`--interactive\` in a terminal to go through the active findings one at a time, most severe first, each shown in full with its number. For each finding, choose Suppress, Continue or Quit. Suppress asks whether the finding is a false positive or an accepted risk, and for a reason, which is required. Then it saves the entry at once, as \`--suppress\` does. When the finding has superseded deterministic findings that \`check --blocking\` still counts, it asks separately whether to suppress them too. Continue leaves the finding active. Quit stops the review and keeps what you saved. At the end, the command shows the review with the findings you suppressed, and lists the entries it saved. \`--interactive\` never prompts in CI, without a terminal, or with \`--no-input\`: it fails before it reads anything. It can't be combined with \`--json\` or \`--suppress\`.

Reports the number of findings to Shopify as usage telemetry, but not finding details. See [usage reporting](https://shopify.dev/docs/api/shopify-cli#usage-reporting) for details.`

  static jsonOutputSchema = appSecurityReviewJsonOutputSchema

  static description = this.descriptionForHelp()

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --interactive',
    '<%= config.bin %> <%= command.id %> --check-id COMMITTED_SECRET --verbose',
    '<%= config.bin %> <%= command.id %> --suppress 3 --kind false-positive --reason="A fake token in a test fixture." --results-digest 1a2b3c4d5e6f',
    '<%= config.bin %> <%= command.id %> --suppress 2 --kind accepted-risk --reason="Kept until the migration ships." --include-superseded',
    '<%= config.bin %> <%= command.id %> --blocking high',
  ]

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
    interactive: Flags.boolean({
      description:
        'Go through the active findings one at a time, most severe first, and choose Suppress, Continue or Quit for each. Needs an interactive terminal.',
      env: 'SHOPIFY_FLAG_APP_SECURITY_INTERACTIVE',
      exclusive: ['json', 'suppress'],
    }),
    ...jsonFlag,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(SecurityReview)

    // Before anything is read: without a terminal that can prompt, `--interactive` fails at once.
    const interactive = flags.interactive ? interactiveSecurityReview() : undefined
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
      ...(interactive ? {interactive} : {}),
    })
    renderSecurityReviewResult(review, {verbose: Boolean(flags.verbose)}, flags.json ? 'json' : 'text')
  }
}
