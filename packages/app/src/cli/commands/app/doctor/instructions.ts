import {appFlags} from '../../../flags.js'
import {
  generateAppDoctorInstructions,
  writeAppDoctorInstructionsResult,
} from '../../../services/app-doctor-instructions.js'
import {appDoctorInstructionsJsonOutputSchema} from '../../../services/app-doctor-instructions-json.js'
import {Flags} from '@oclif/core'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'
import {resolvePath} from '@shopify/cli-kit/node/path'

export default class DoctorInstructions extends BaseCommand {
  static hidden = true

  static summary = 'Provide App Doctor instructions to a coding agent.'

  static descriptionWithMarkdown = `Prints a self-contained workflow that a coding agent follows to review your app's source code with App Doctor's semantic checks. No prior \`shopify app doctor\` scan is required.

The instructions embed every check prompt from this CLI and, for each review scope, the exact \`shopify app doctor record\` command to run. That command carries an opaque review token that binds the agent's findings document to this app configuration, the scope directory, and the exact check prompts it received. After recording, \`shopify app doctor status\` reads the result back.

By default, the whole app is one review scope; pass \`--review\` to review specific directories instead. The instructions are printed to stdout. Use \`--copy\` to copy them to the clipboard, \`--write\` to write them to a file, or \`--json\` to print the structured result including the review tokens and record commands.`

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    path: appFlags.path,
    config: appFlags.config,
    'client-id': appFlags['client-id'],
    review: Flags.string({
      multiple: true,
      description: 'Review only this directory (repeatable). Omit to review the whole app.',
      parse: async (input) => resolvePath(input),
      env: 'SHOPIFY_FLAG_APP_DOCTOR_REVIEW',
    }),
    copy: Flags.boolean({
      description: 'Copy the instructions to the clipboard instead of printing them.',
      default: false,
      exclusive: ['write', 'json'],
      env: 'SHOPIFY_FLAG_APP_DOCTOR_INSTRUCTIONS_COPY',
    }),
    write: Flags.string({
      description: 'Write the instructions to a file instead of printing them.',
      exclusive: ['copy', 'json'],
      parse: async (input) => resolvePath(input),
      env: 'SHOPIFY_FLAG_APP_DOCTOR_INSTRUCTIONS_WRITE',
    }),
  }

  static get jsonOutputSchema() {
    return appDoctorInstructionsJsonOutputSchema
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(DoctorInstructions)
    const options = {
      directory: flags.path,
      configName: flags.config,
      clientId: flags['client-id'],
      reviewDirectories: flags.review,
      interactive: isTerminalInteractive(),
      format: flags.json ? ('json' as const) : ('text' as const),
      copy: flags.copy,
      writePath: flags.write,
    }

    const result = await generateAppDoctorInstructions(options)
    await writeAppDoctorInstructionsResult(result, options)
  }
}
