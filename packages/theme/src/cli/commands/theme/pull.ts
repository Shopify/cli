import {themeFlags} from '../../flags.js'
import {requiredThemeStore} from '../../utilities/theme-store.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {isAbsolutePath, resolvePath} from '@shopify/cli-kit/node/path'

export default class Pull extends ThemeCommand {
  static description = 'Download your remote theme files locally.'

  static flags = {
    ...globalFlags,
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
    force: Flags.boolean({
      hidden: true,
      char: 'f',
      description: 'Proceed without confirmation, if current directory does not seem to be theme directory.',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
  }

  static cli2Flags = ['theme', 'development', 'live', 'nodelete', 'only', 'ignore', 'force']

  async run(): Promise<void> {
    const {flags} = await this.parse(Pull)

    let validPath = flags.path
    if (!isAbsolutePath(validPath)) {
      validPath = resolvePath(flags.path)
    }

    const flagsToPass = this.passThroughFlags(flags, {allowedFlags: Pull.cli2Flags})

    const command = ['theme', 'pull', validPath, ...flagsToPass]

    const store = requiredThemeStore(flags)
    const adminSession = await ensureAuthenticatedThemes(store, flags.password)
    await execCLI2(command, {adminSession})
  }
}
