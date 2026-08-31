import deliverAppDoctorInstructions from '../../../services/app-doctor-instructions.js'
import {Args, Flags} from '@oclif/core'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'

export default class DoctorInstructions extends BaseCommand {
  static hidden = true

  static summary = 'Provide App Doctor instructions to a coding agent.'

  static descriptionWithMarkdown = `Prints the complete workflow that a coding agent should follow to review App Doctor results.

By default, the instructions are printed to stdout. Use \`--copy\` to copy them to the clipboard or \`--write\` to write them to a file. When the app directory already contains \`app-doctor-review.json\`, the instructions start from those existing scan results.`

  static description = this.descriptionWithoutMarkdown()

  static args = {
    directory: Args.string({
      description: 'The app directory containing App Doctor results. Defaults to the current directory.',
      parse: async (input) => resolvePath(input),
    }),
  }

  static flags = {
    ...globalFlags,
    copy: Flags.boolean({
      description: 'Copy the instructions to the clipboard instead of printing them.',
      default: false,
      exclusive: ['write'],
      env: 'SHOPIFY_FLAG_APP_DOCTOR_INSTRUCTIONS_COPY',
    }),
    write: Flags.string({
      description: 'Write the instructions to a file instead of printing them.',
      exclusive: ['copy'],
      parse: async (input) => resolvePath(input),
      env: 'SHOPIFY_FLAG_APP_DOCTOR_INSTRUCTIONS_WRITE',
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(DoctorInstructions)

    await deliverAppDoctorInstructions({
      directory: args.directory ?? cwd(),
      copy: flags.copy,
      writePath: flags.write,
    })
  }
}
