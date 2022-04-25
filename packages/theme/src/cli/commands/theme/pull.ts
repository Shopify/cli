import {Command, Flags} from '@oclif/core'
import {path, ruby, session, string} from '@shopify/cli-kit'
import {getThemeStore} from '$cli/utilities/theme-store'

export default class Pull extends Command {
  static description = 'Download your remote theme files locally.'

  static flags = {
    theme: Flags.string({
      description: 'Theme ID or name of the remote theme.',
      env: 'SHOPIFY_FLAG_THEME_ID',
    }),
    development: Flags.boolean({
      char: 'd',
      description: 'Pull theme files from your remote development theme.',
      env: 'SHOPIFY_FLAG_THEME_DEVELOPMENT',
    }),
    live: Flags.boolean({
      char: 'l',
      description: 'Pull theme files from your remote live theme.',
      env: 'SHOPIFY_FLAG_THEME_LIVE',
    }),
    nodelete: Flags.boolean({
      char: 'n',
      description: 'Runs the pull command without deleting local files.',
      env: 'SHOPIFY_FLAG_THEME_NODELETE',
    }),
    only: Flags.boolean({
      char: 'o',
      description: 'Download only the specified files (Multiple flags allowed).',
      env: 'SHOPIFY_FLAG_THEME_ONLY',
    }),
    ignore: Flags.boolean({
      char: 'x',
      description: 'Skip downloading the specified files (Multiple flags allowed).',
      env: 'SHOPIFY_FLAG_THEME_IGNORE',
    }),
    path: Flags.string({
      description: 'The path to your theme',
      default: '.',
      env: 'SHOPIFY_FLAG_PATH',
      parse: (input, _) => Promise.resolve(path.resolve(input)),
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

    const command = ['theme', 'pull', validPath]
    if (flags.theme) {
      command.push('-t')
      command.push(flags.theme)
    }
    if (flags.development) {
      command.push('-d')
    }
    if (flags.live) {
      command.push('-l')
    }
    if (flags.nodelete) {
      command.push('-n')
    }
    if (flags.only) {
      command.push('-o')
    }
    if (flags.ignore) {
      command.push('-n')
    }

    const store = getThemeStore(flags)
    const adminSession = await session.ensureAuthenticatedAdmin(store)
    await ruby.execCLI(command, adminSession)
  }
}
