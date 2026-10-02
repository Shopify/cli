import {appSecurityBlockingFlag} from './blocking-flag.js'
import {appSecuritySelectionFlags} from './selection-flags.js'
import securityCheck from '../../../services/security-check.js'
import {Flags} from '@oclif/core'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class SecurityCheck extends BaseCommand {
  static summary =
    'Check an app for Shopify-specific security issues and write deterministic-findings.json and agent-checks.json.'

  static descriptionWithMarkdown = `Runs Shopify App Security locally and writes \`deterministic-findings.json\` and \`agent-checks.json\` to the results directory, \`.shopify/app-security/<results key>/\`. The results key is \`--client-id\` when you pass it, and otherwise the name of the app configuration file without \`.toml\`; the other \`app security\` commands take the same selection flags and find the same directory. Every run replaces both files, so it's always safe to run the check again.

\`deterministic-findings.json\` holds the deterministic scan results. \`agent-checks.json\` holds the checks for your coding agent to investigate; the agent's results are recorded with \`shopify app security record\`. Use \`--config\` to select a specific app configuration when the project has multiple \`shopify.app*.toml\` files; App Security inspects only that configuration. Use \`--client-id\` to replace the configuration's client ID for this run. When no app configuration exists, use \`--without-app-config --client-id <client-id>\` to scan \`--path\` anyway with config checks skipped; in an interactive terminal the command offers to do this.

The check scans the app directory and each \`--include-dir\`. Git ignore rules apply by default: a file or directory that Git ignores is skipped, using the rules of the repository that contains it, while files that Git tracks are always scanned. Use \`--no-git-ignore\` to turn Git ignore rules off for every scanned directory.

Use \`--exclude\` to skip more paths. Each value is a glob that is matched against the path relative to the working directory, so a path above it starts with \`../\`, and a name at any depth needs \`**/\`, for example \`--exclude '**/generated'\`. Repeat the flag to add globs. An exclusion can't remove the selected app configuration file. Quote each value so your shell doesn't expand \`*\`. The coding-agent instructions this check offers repeat the globs. Other \`app security\` commands don't take \`--exclude\` or \`--no-git-ignore\`, so pass the same flags each time you run the check.

Use \`--list-files\` to check the scope before scanning: it prints the files the check would gather, one path per line and relative to the app directory (\`{"files": [...]}\` with \`--json\`), and then stops. It writes no results and never prompts. \`--client-id\` is accepted but has no effect on the list.

In interactive terminals, the command offers to copy the coding-agent instructions, print them, or choose nothing; copying is the default. In CI and other non-interactive environments, instructions aren't offered unless you pass \`--yes\`, which prints them. JSON output never prompts or prints those instructions. You can also run \`shopify app security instructions\` to print, copy, or write them later.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appSecuritySelectionFlags,
    // No environment variable: oclif passes a repeatable flag's variable as one string, so it could hold only one directory.
    // eslint-disable-next-line @shopify/cli/command-flags-with-env
    'include-dir': Flags.string({
      description:
        'Also scan this directory, relative to the working directory. Repeat the flag to add directories. Use it for code that lives outside the app directory, such as a backend or a shared library.',
      multiple: true,
    }),
    // No environment variable: oclif passes a repeatable flag's variable as one string, so it could hold only one pattern.
    // eslint-disable-next-line @shopify/cli/command-flags-with-env
    exclude: Flags.string({
      description:
        "Skip paths that match this glob, relative to the working directory. Repeat the flag to add globs. The selected app configuration file can't be excluded.",
      multiple: true,
    }),
    'no-git-ignore': Flags.boolean({
      description:
        'Turn off Git ignore rules for every scanned directory, so files that Git ignores are scanned too. Files that Git tracks are always scanned.',
      env: 'SHOPIFY_FLAG_NO_GIT_IGNORE',
    }),
    'list-files': Flags.boolean({
      description:
        'Print the files the check would gather, one path per line, and stop. Nothing is scanned, recorded or prompted for.',
      env: 'SHOPIFY_FLAG_LIST_FILES',
      exclusive: ['yes', 'skip-instructions', 'blocking'],
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
      includeDirs: flags['include-dir'] ?? [],
      excludePatterns: flags.exclude ?? [],
      noGitIgnore: Boolean(flags['no-git-ignore']),
      listFiles: Boolean(flags['list-files']),
    })
  }
}
