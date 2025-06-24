import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {push, PushFlags, UnpublishedOption} from '../../services/push.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {getRandomName} from '@shopify/cli-kit/common/string'

export default class Share extends ThemeCommand {
  static summary = 'Creates a shareable, unpublished, and new theme on your theme library with a randomized name.'

  static descriptionWithMarkdown = `Uploads your theme as a new, unpublished theme in your theme library. The theme is given a randomized name.

  This command returns a [preview link](https://help.shopify.com/manual/online-store/themes/adding-themes#share-a-theme-preview-with-others) that you can share with others.`

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

  static cli2Flags = ['force']

  async run(): Promise<void> {
    const {flags} = await this.parse(Share)

    const pushFlags: PushFlags = {
      force: flags.force,
      path: flags.path,
      password: flags.password,
      store: flags.store,
      unpublished: UnpublishedOption.Create,
      theme: getRandomName('creative'),
    }

    await push(pushFlags)
  }
}
