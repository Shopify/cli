import {appFlags} from '../../../flags.js'
import securityCheck from '../../../services/security-check.js'
import {Flags} from '@oclif/core'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {resolvePath} from '@shopify/cli-kit/node/path'
import type {AppSecurityBlockingLevel} from '../../../services/app-security-api.js'

const blockingLevels: AppSecurityBlockingLevel[] = ['high', 'medium', 'low', 'none']

export default class SecurityCheck extends BaseCommand {
  static hidden = true

  static summary = 'Check an app for Shopify-specific security issues.'

  static descriptionWithMarkdown = `Runs Shopify App Security locally and creates its review pack and trace.

Pass \`--findings\` after completing the review pack to validate agent findings and compile them into the trace. Use \`--config\` to select a specific app configuration when the project has multiple \`shopify.app*.toml\` files; App Security inspects only that configuration. In interactive terminals, the command offers to copy the coding-agent instructions, print them, or choose nothing; copying is the default. In CI and other non-interactive environments, instructions aren't offered unless you pass \`--yes\`, which prints them. JSON output never prompts or prints those instructions. You can also run \`shopify app security instructions\` to print, copy, or write them later.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    path: appFlags.path,
    config: appFlags.config,
    ...jsonFlag,
    findings: Flags.string({
      description: 'Validate agent findings from a JSON file and compile them into the trace.',
      parse: async (input) => resolvePath(input),
      env: 'SHOPIFY_FLAG_APP_SECURITY_FINDINGS',
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
      findingsPath: flags.findings,
    })
  }
}
