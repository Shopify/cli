import {appFlags} from '../../../flags.js'
import {ignorePatternProblem} from '../../../services/app-security-engine/index.js'
import securityCheck from '../../../services/security-check.js'
import {Flags} from '@oclif/core'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {AppSecurityBlockingLevel} from '../../../services/app-security-api.js'

const blockingLevels: AppSecurityBlockingLevel[] = ['high', 'medium', 'low', 'none']

export default class SecurityCheck extends BaseCommand {
  static hidden = true

  static summary = 'Check an app for Shopify-specific security issues.'

  static descriptionWithMarkdown = `Runs Shopify App Security locally and creates its review pack and trace.

Pass \`--clean\` to discard the current local review and start over. Use \`--config\` to select a specific app configuration when the project has multiple \`shopify.app*.toml\` files; App Security inspects only that configuration.

Use \`--ignore\` to change which files are scanned. Each value is one \`.gitignore\` pattern relative to the app directory; prefix it with \`!\` to include a file again when it is ignored by default or by \`.gitignore\`. Repeat the flag to add patterns; later patterns take precedence. A file can't be included again while its parent folder is ignored, so include the folder again instead, for example \`--ignore '!build/'\`. Quote each value so your shell doesn't expand \`!\` or \`*\` (single quotes in POSIX shells and PowerShell). The coding-agent instructions this check offers repeat the patterns.

In interactive terminals, the command offers to copy the coding-agent instructions, print them, or choose nothing; copying is the default. In CI and other non-interactive environments, instructions aren't offered unless you pass \`--yes\`, which prints them. JSON output never prompts or prints those instructions. You can also run \`shopify app security instructions\` to print, copy, or write them later.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    path: appFlags.path,
    config: appFlags.config,
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
    // Deliberately not bound to an environment variable: clean discards local review work, so it must be an
    // explicit per-invocation decision rather than something inherited from a shell or CI environment.
    // eslint-disable-next-line @shopify/cli/command-flags-with-env
    clean: Flags.boolean({
      description: 'Discard the current local review and start a new scan.',
      default: false,
    }),
    blocking: Flags.string({
      description: 'The minimum finding severity that causes a non-zero exit code.',
      options: blockingLevels,
      default: 'none',
      env: 'SHOPIFY_FLAG_APP_SECURITY_BLOCKING',
    }),
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
      json: flags.json,
      verbose: Boolean(flags.verbose),
      blocking: flags.blocking as AppSecurityBlockingLevel,
      yes: flags.yes,
      skipInstructions: flags['skip-instructions'],
      clean: flags.clean,
      ignorePatterns: flags.ignore ?? [],
    })
  }
}
