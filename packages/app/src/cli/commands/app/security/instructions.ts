import {appFlags} from '../../../flags.js'
import deliverAppSecurityInstructions from '../../../services/app-security-instructions.js'
import {Flags} from '@oclif/core'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {resolvePath} from '@shopify/cli-kit/node/path'

export default class SecurityInstructions extends BaseCommand {
  static hidden = true

  static summary = 'Provide App Security instructions to a coding agent.'

  static descriptionWithMarkdown = `Prints the complete workflow that a coding agent should follow to review App Security results.

By default, the instructions are printed to stdout. Use \`--copy\` to copy them to the clipboard or \`--write\` to write them to a file. Standalone instructions always start by running \`shopify app security check\`; only that invocation's generated review pack is trusted as workflow input.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    path: appFlags.path,
    copy: Flags.boolean({
      description: 'Copy the instructions to the clipboard instead of printing them.',
      default: false,
      exclusive: ['write'],
      env: 'SHOPIFY_FLAG_APP_SECURITY_INSTRUCTIONS_COPY',
    }),
    write: Flags.string({
      description: 'Write the instructions to a file instead of printing them.',
      exclusive: ['copy'],
      parse: async (input) => resolvePath(input),
      env: 'SHOPIFY_FLAG_APP_SECURITY_INSTRUCTIONS_WRITE',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(SecurityInstructions)

    await deliverAppSecurityInstructions({
      directory: flags.path,
      copy: flags.copy,
      writePath: flags.write,
    })
  }
}
