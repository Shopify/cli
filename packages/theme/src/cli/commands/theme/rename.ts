import ThemeCommand from '../../utilities/theme-command.js'
import {Args} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class Rename extends ThemeCommand {
  static description = 'Renames an existing theme.'

  static flags = {
    ...globalFlags,
  }

  static args = {
    name: Args.string({
      name: 'name',
      required: true,
      description: 'The new name for the theme.',
    }),
  }

  public async run(): Promise<void> {
    const {args} = await this.parse(Rename)
  }
}
