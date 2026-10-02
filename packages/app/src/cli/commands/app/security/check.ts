import {appSecurityBlockingFlag} from './blocking-flag.js'
import {appSecuritySelectionFlags} from './selection-flags.js'
import {ignorePatternProblem} from '../../../services/app-security-engine/index.js'
import securityCheck from '../../../services/security-check.js'
import {Flags} from '@oclif/core'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {AbortError} from '@shopify/cli-kit/node/error'

export default class SecurityCheck extends BaseCommand {
  static hidden = true

  static summary =
    'Check an app for Shopify-specific security issues and write deterministic-findings.json and agent-checks.json.'

  static descriptionWithMarkdown = `Runs Shopify App Security locally and writes \`deterministic-findings.json\` and \`agent-checks.json\` to the results directory, \`.shopify/app-security/<results key>/\`. The results key is \`--client-id\` when you pass it, and otherwise the name of the app configuration file without \`.toml\`; the other \`app security\` commands take the same selection flags and find the same directory. Every run replaces both files, so it's always safe to run the check again.

\`deterministic-findings.json\` holds the deterministic scan results. \`agent-checks.json\` holds the checks for your coding agent to investigate; the agent's results are recorded with \`shopify app security record\`. Use \`--config\` to select a specific app configuration when the project has multiple \`shopify.app*.toml\` files; App Security inspects only that configuration. Use \`--client-id\` to replace the configuration's client ID for this run. When no app configuration exists, use \`--without-app-config --client-id <client-id>\` to scan \`--path\` anyway with config checks skipped; in an interactive terminal the command offers to do this.

Use \`--ignore\` to change which files are scanned. Each value is one \`.gitignore\` pattern relative to the app directory; prefix it with \`!\` to include a file again when it is ignored by default or by \`.gitignore\`. Repeat the flag to add patterns; later patterns take precedence. A file can't be included again while its parent folder is ignored, so include the folder again instead, for example \`--ignore '!build/'\`. Quote each value so your shell doesn't expand \`!\` or \`*\` (single quotes in POSIX shells and PowerShell). The coding-agent instructions this check offers repeat the patterns. Other \`app security\` commands don't take \`--ignore\`, so pass the same patterns each time you run the check.

In interactive terminals, the command offers to copy the coding-agent instructions, print them, or choose nothing; copying is the default. In CI and other non-interactive environments, instructions aren't offered unless you pass \`--yes\`, which prints them. JSON output never prompts or prints those instructions. You can also run \`shopify app security instructions\` to print, copy, or write them later.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appSecuritySelectionFlags,
    // No environment variable: oclif passes a repeatable flag's variable as one string, so it could hold only one pattern.
    // eslint-disable-next-line @shopify/cli/command-flags-with-env
    ignore: Flags.string({
      description:
        'Ignore files that match this .gitignore pattern, relative to the app directory. Start the pattern with ! to include matching files again. Repeat the flag to add patterns; later patterns take precedence.',
      multiple: true,
      parse: async (input) => {
        const problem = ignorePatternProblem(input)
        if (problem) throw new AbortError(problem)
        return input
      },
    }),
    ...jsonFlag,
    ...appSecurityBlockingFlag,
    yes: Flags.boolean({
      description: 'Print coding-agent instructions without prompting.',
      default: false,
      exclusive: ['skip-instructions'],
      env: 'SHOPIFY_FLAG_YES',
    }),
    'skip-instructions': Flags.boolean({
      description: "Don't offer to show coding-agent instructions.",
      default: false,
      exclusive: ['yes'],
      env: 'SHOPIFY_FLAG_APP_SECURITY_SKIP_INSTRUCTIONS',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(SecurityCheck)

    await securityCheck({
      directory: flags.path,
      configName: flags.config,
      clientId: flags['client-id'],
      withoutAppConfig: Boolean(flags['without-app-config']),
      json: flags.json,
      verbose: Boolean(flags.verbose),
      blocking: flags.blocking,
      yes: flags.yes,
      skipInstructions: flags['skip-instructions'],
      ignorePatterns: flags.ignore ?? [],
    })
  }
}
