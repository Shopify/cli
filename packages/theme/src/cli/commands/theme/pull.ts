import {themeFlags} from '../../flags.js'
import {getTheme} from '../../utilities/theme-store.js'
import ThemeCommand from '../theme-command.js'
import {Flags} from '@oclif/core'
import {cli, path, session, string} from '@shopify/cli-kit'
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
    store: Flags.string({
      char: 's',
      description: 'Store URL',
      env: 'SHOPIFY_FLAG_STORE',
      parse: (input, _) => Promise.resolve(string.normalizeStoreName(input)),
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Pull)

    let validPath = flags.path
    if (!path.isAbsolute(validPath)) {
      validPath = path.resolve(flags.path)
    }

    const flagsToPass = this.passThroughFlags(flags, {exclude: ['path', 'verbose']})

    const command = ['theme', 'pull', validPath, ...flagsToPass]

    const store = getTheme(flags)
    const adminSession = await session.ensureAuthenticatedAdmin(store)
    await execCLI2(command, {adminSession})
  }
}
