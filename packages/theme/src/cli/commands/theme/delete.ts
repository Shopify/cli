import {getThemeStore} from '../../utilities/theme-store.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {themeFlags} from '../../flags.js'
import {Flags} from '@oclif/core'
import {cli, session} from '@shopify/cli-kit'
import {execCLI2} from '@shopify/cli-kit/node/ruby'

export default class Delete extends ThemeCommand {
  static description = "Delete remote themes from the connected store. This command can't be undone"

  // Accept any number of args without naming them
  static strict = false

  static flags = {
    ...cli.globalFlags,
    password: themeFlags.password,
    development: Flags.boolean({
      char: 'd',
      description: 'Delete your development theme.',
      env: 'SHOPIFY_FLAG_DEVELOPMENT',
    }),
    'show-all': Flags.boolean({
      char: 'a',
      description: 'Include others development themes in theme list.',
      env: 'SHOPIFY_FLAG_SHOW_ALL',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Skip confirmation.',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
    store: themeFlags.store,
  }

  async run(): Promise<void> {
    const {flags, argv} = await this.parse(Delete)

    const store = await getThemeStore(flags)

    const command = ['theme', 'delete']

    if (argv.length > 0) {
      command.push(...argv)
    }

    const flagsToPass = this.passThroughFlags(flags, {exclude: ['store', 'verbose', 'password']})
    command.push(...flagsToPass)

    const adminSession = await session.ensureAuthenticatedThemes(store, flags.password)
    await execCLI2(command, {adminSession})
  }
}
