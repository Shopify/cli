import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import Command from '@shopify/cli-kit/node/base-command'
import {execCLI2} from '@shopify/cli-kit/node/ruby'

export default class HelpOld extends Command {
  static description = 'Show help from Ruby CLI'
  static hidden = true

  static flags = {
    ...globalFlags,
    command: Flags.string({
      description: 'The command for which to show CLI2 help.',
      env: 'SHOPIFY_FLAG_COMMAND',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(HelpOld)
    const cli2Args: string[] = ['theme']
    if (flags.command) cli2Args.push(flags.command)
    cli2Args.push('-h')
    await execCLI2(cli2Args)
  }
}
