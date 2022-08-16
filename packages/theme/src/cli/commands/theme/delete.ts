import {getTheme} from '../../utilities/theme-store.js'
import ThemeCommand from '../theme-command.js'
import {Flags} from '@oclif/core'
import {cli, session, string} from '@shopify/cli-kit'
import {execCLI2} from '@shopify/cli-kit/node/ruby'

export default class Delete extends ThemeCommand {
  static description = "Delete remote themes from the connected store. This command can't be undone"

  // Accept any number of args without naming them
  static strict = false

  static flags = {
    ...cli.globalFlags,
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
    store: Flags.string({
      char: 's',
      description: 'Store URL',
      env: 'SHOPIFY_FLAG_STORE',
      parse: (input, _) => Promise.resolve(string.normalizeStoreName(input)),
    }),
  }

  async run(): Promise<void> {
    const {flags, argv} = await this.parse(Delete)

    const store = getTheme(flags)

    const command = ['theme', 'delete']

    if (argv.length > 0) {
      command.push(...argv)
    }

    const flagsToPass = this.passThroughFlags(flags, {exclude: ['store', 'verbose']})
    command.push(...flagsToPass)

    const adminSession = await session.ensureAuthenticatedAdmin(store)
    await execCLI2(command, {adminSession})
  }
}
