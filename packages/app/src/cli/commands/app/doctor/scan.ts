import doctor from '../../../services/doctor.js'
import {Args, Flags} from '@oclif/core'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import type {AppDoctorBlockingLevel} from '../../../services/app-doctor-api.js'

const blockingLevels: AppDoctorBlockingLevel[] = ['critical', 'high', 'medium', 'low', 'none']

export default class DoctorScan extends BaseCommand {
  static hidden = true

  static summary = 'Check an app for Shopify-specific security issues.'

  static descriptionWithMarkdown = `Runs Shopify App Doctor locally and creates its review pack and trace.

Pass \`--findings\` after completing the review pack to validate agent findings and compile them into the trace. In interactive terminals, the command offers to print instructions that you can hand to your coding agent. In CI and other non-interactive environments, instructions aren't printed unless you pass \`--yes\`. JSON output never prompts or prints those instructions. You can also run \`shopify app doctor instructions\` to print, copy, or write them later.`

  static description = this.descriptionWithoutMarkdown()

  static args = {
    directory: Args.string({
      description: 'The app directory to check. Defaults to the current directory.',
      parse: async (input) => resolvePath(input),
    }),
  }

  static flags = {
    ...globalFlags,
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
      description: 'Show coding-agent instructions without prompting.',
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
    const {args, flags} = await this.parse(DoctorScan)

    await doctor({
      directory: args.directory ?? cwd(),
      json: flags.json,
      verbose: Boolean(flags.verbose),
      blocking: flags.blocking as AppDoctorBlockingLevel,
      yes: flags.yes,
      skipInstructions: flags['skip-instructions'],
      findingsPath: flags.findings,
    })
  }
}
