import {appFlags} from '../../flags.js'
import doctor from '../../services/doctor.js'
import {Flags} from '@oclif/core'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {resolvePath} from '@shopify/cli-kit/node/path'
import type {AppDoctorBlockingLevel} from '../../services/app-doctor-api.js'

const blockingLevels: AppDoctorBlockingLevel[] = ['high', 'medium', 'low', 'none']

export default class Doctor extends BaseCommand {
  static hidden = true

  static summary = 'Check an app for Shopify-specific security issues.'

  static descriptionWithMarkdown = `Runs Shopify App Doctor locally and creates its review pack and trace.

Pass \`--findings\` after completing the review pack to validate agent findings and compile them into the trace. In interactive terminals, the command offers to copy the coding-agent instructions, print them, or choose nothing; copying is the default. In CI and other non-interactive environments, instructions aren't offered unless you pass \`--yes\`, which prints them. JSON output never prompts or prints those instructions. You can also run \`shopify app doctor instructions\` to print, copy, or write them later.

CVE detection runs \`npm audit\` (or the pnpm/yarn equivalent) in an isolated sandbox and sends package names and versions to the public npm registry at https://registry.npmjs.org/.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    path: appFlags.path,
    ...jsonFlag,
    findings: Flags.string({
      description: 'Validate agent findings from a JSON file and compile them into the trace.',
      parse: async (input) => resolvePath(input),
      env: 'SHOPIFY_FLAG_APP_DOCTOR_FINDINGS',
    }),
    blocking: Flags.string({
      description: 'The minimum finding severity that causes a non-zero exit code.',
      options: blockingLevels,
      default: 'none',
      env: 'SHOPIFY_FLAG_APP_DOCTOR_BLOCKING',
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
      env: 'SHOPIFY_FLAG_APP_DOCTOR_SKIP_INSTRUCTIONS',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Doctor)

    await doctor({
      directory: flags.path,
      json: flags.json,
      verbose: Boolean(flags.verbose),
      blocking: flags.blocking as AppDoctorBlockingLevel,
      yes: flags.yes,
      skipInstructions: flags['skip-instructions'],
      findingsPath: flags.findings,
    })
  }
}
