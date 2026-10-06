import {appSecuritySelectionFlags} from './selection-flags.js'
import {resolveAppSecurityCommands} from '../../../services/app-security-commands.js'
import {deliverAppSecurityInstructions} from '../../../services/app-security-instructions-output.js'
import {requireResultsDirectory} from '../../../services/app-security-results.js'
import {resolveAppSecuritySelection, resultsKey} from '../../../services/app-security-selection.js'
import {
  securityInstructionsJsonOutputSchema,
  toAppSecurityInstructionsJson,
} from '../../../services/security-instructions-json.js'
import {Flags} from '@oclif/core'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'
import {resolvePath} from '@shopify/cli-kit/node/path'

export default class SecurityInstructions extends BaseCommand {
  static hidden = true

  static summary = 'Provide app security check instructions to a coding agent.'

  static descriptionWithMarkdown = `Prints the complete workflow that a coding agent should follow to review app security check results.

By default, the instructions are printed to stdout. Use \`--copy\` to copy them to the clipboard or \`--write\` to write them to a file. With \`--json\`, the instructions are in the result's \`instructions\` field instead of printed, also when you copy or write them. Standalone instructions always start by running \`shopify app security check\`; only that invocation's generated review pack is trusted as workflow input.`

  static get jsonOutputSchema() {
    return securityInstructionsJsonOutputSchema
  }

  static description = this.descriptionForHelp()

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
    ...jsonFlag,
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
    await requireResultsDirectory(selection, flags.path)

    const delivery = await deliverAppSecurityInstructions({
      appDirectory: selection.appDirectory,
      resultsKey: resultsKey(selection),
      commands: resolveAppSecurityCommands(selection, flags.path),
      copy: flags.copy,
      writePath: flags.write,
      json: flags.json,
    })

    if (flags.json) {
      outputResult(securityInstructionsJsonOutputSchema.encode({instructions: toAppSecurityInstructionsJson(delivery)}))
    }
  }
}
