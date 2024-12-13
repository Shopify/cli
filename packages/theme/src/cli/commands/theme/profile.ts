import ThemeCommand from '../../utilities/theme-command.js'
import {profile} from '../../services/profile.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class Profile extends ThemeCommand {
  static summary = 'Profile the Liquid rendering of a theme page, and return JSON profiling data.'

  static descriptionWithMarkdown = `TODO`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    url: Flags.string({
      char: 'u',
      description: 'URL to the theme page to profile.',
      env: 'SHOPIFY_FLAG_URL',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Profile)

    await profile(flags.url)
  }
}
