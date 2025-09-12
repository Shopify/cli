import {themeFlags} from '../../../flags.js'
import {metafieldsPull, MetafieldsPullFlags} from '../../../services/metafields-pull.js'
import ThemeCommand, {RequiredFlags} from '../../../utilities/theme-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {InferredFlags} from '@oclif/core/interfaces'

type MetafieldsFlags = InferredFlags<typeof MetafieldsPull.flags>

export default class MetafieldsPull extends ThemeCommand {
  static summary = 'Download metafields definitions from your shop into a local file.'

  static descriptionWithMarkdown = `Retrieves metafields from Shopify Admin.

If the metafields file already exists, it will be overwritten.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...themeFlags,
    force: Flags.boolean({
      hidden: true,
      char: 'f',
      description: 'Proceed without confirmation, if current directory does not seem to be theme directory.',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
  }

  static multiEnvironmentsFlags: RequiredFlags = null

  async command(flags: MetafieldsFlags) {
    const args: MetafieldsPullFlags = {
      path: flags.path,
      password: flags.password,
      store: flags.store,
      force: flags.force,
      verbose: flags.verbose,
      noColor: flags['no-color'],
    }

    await metafieldsPull(args)
  }
}
