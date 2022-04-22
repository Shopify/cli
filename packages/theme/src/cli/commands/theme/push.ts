import {Command, Flags} from '@oclif/core'
import {path, ruby, session, string} from '@shopify/cli-kit'
import {getThemeStore} from '$cli/utilities/theme-store'

export default class Push extends Command {
  static description =
    'Uploads your local theme files to the connected store, overwriting the remote version if specified.'

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
    unpublished: Flags.boolean({
      char: 'u',
      description: 'Create a new unpublished theme and push to it.',
      env: 'SHOPIFY_FLAG_THEME_UNPUBLISHED',
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
    json: Flags.boolean({
      char: 'j',
      description: 'Output JSON instead of a UI.',
      env: 'SHOPIFY_FLAG_THEME_JSON',
    }),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'allow-live': Flags.boolean({
      char: 'a',
      description: 'Allow push to a live theme.',
      env: 'SHOPIFY_FLAG_THEME_ALLOW_LIVE',
    }),
    publish: Flags.boolean({
      char: 'p',
      description: 'Publish as the live theme after uploading.',
      env: 'SHOPIFY_FLAG_THEME_PUBLISH',
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
    const {flags} = await this.parse(Push)

    const command = ['theme', 'push', flags.path]
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
      command.push('-x')
    }
    if (flags.json) {
      command.push('-j')
    }
    if (flags.unpublished) {
      command.push('-u')
    }
    if (flags.publish) {
      command.push('-p')
    }
    if (flags['allow-live']) {
      command.push('-a')
    }

    const store = getThemeStore(flags)
    const adminSession = await session.ensureAuthenticatedAdmin(store)
    await ruby.execCLI(command, adminSession)
  }
}
