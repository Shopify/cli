import {appSecuritySelectionFlags} from './selection-flags.js'
import {resolveAppSecurityCommands} from '../../../services/app-security-commands.js'
import deliverAppSecurityInstructions from '../../../services/app-security-instructions.js'
import {resolveAppSecuritySelection, resultsKey} from '../../../services/app-security-selection.js'
import {Flags} from '@oclif/core'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {resolvePath} from '@shopify/cli-kit/node/path'

export default class SecurityInstructions extends BaseCommand {
  static summary = 'Provide app security check instructions to a coding agent.'

  static descriptionWithMarkdown = `Prints the complete workflow that a coding agent should follow to review app security check results.

By default, the instructions are printed to stdout. Use \`--copy\` to copy them to the clipboard or \`--write\` to write them to a file. Standalone instructions always start by running \`shopify app security check\`; only that invocation's generated review pack is trusted as workflow input.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appSecuritySelectionFlags,
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

    const selection = await resolveAppSecuritySelection({
      path: flags.path,
      config: flags.config,
      clientId: flags['client-id'],
      withoutAppConfig: flags['without-app-config'],
      allowPrompts: false,
    })
    await deliverAppSecurityInstructions({
      appDirectory: selection.appDirectory,
      resultsKey: resultsKey(selection),
      commands: resolveAppSecurityCommands(selection, flags.path),
      copy: flags.copy,
      writePath: flags.write,
    })
  }
}
