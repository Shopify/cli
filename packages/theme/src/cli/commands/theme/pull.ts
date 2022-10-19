import {themeFlags} from '../../flags.js'
import {getThemeStore} from '../../utilities/theme-store.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {Flags} from '@oclif/core'
import {cli, path, session} from '@shopify/cli-kit'
import {execCLI2} from '@shopify/cli-kit/node/ruby'

export default class Pull extends ThemeCommand {
  static description = 'Download your remote theme files locally.'

  static flags = {
    ...cli.globalFlags,
    ...themeFlags,
    theme: Flags.string({
      char: 't',
      description: 'Theme ID or name of the remote theme.',
      env: 'SHOPIFY_FLAG_THEME_ID',
    }),
    development: Flags.boolean({
      char: 'd',
      description: 'Pull theme files from your remote development theme.',
      env: 'SHOPIFY_FLAG_DEVELOPMENT',
    }),
    live: Flags.boolean({
      char: 'l',
      description: 'Pull theme files from your remote live theme.',
      env: 'SHOPIFY_FLAG_LIVE',
    }),
    nodelete: Flags.boolean({
      char: 'n',
      description: 'Runs the pull command without deleting local files.',
      env: 'SHOPIFY_FLAG_NODELETE',
    }),
    only: Flags.string({
      char: 'o',
      multiple: true,
      description: 'Download only the specified files (Multiple flags allowed).',
      env: 'SHOPIFY_FLAG_ONLY',
    }),
    ignore: Flags.string({
      char: 'x',
      multiple: true,
      description: 'Skip downloading the specified files (Multiple flags allowed).',
      env: 'SHOPIFY_FLAG_IGNORE',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Pull)

    let validPath = flags.path
    if (!path.isAbsolute(validPath)) {
      validPath = path.resolve(flags.path)
    }

    const flagsToPass = this.passThroughFlags(flags, {exclude: ['path', 'verbose', 'store', 'password']})

    const command = ['theme', 'pull', validPath, ...flagsToPass]

    const store = await getThemeStore(flags)
    const adminSession = await session.ensureAuthenticatedThemes(store, flags.password)
    await execCLI2(command, {adminSession})
  }
}
