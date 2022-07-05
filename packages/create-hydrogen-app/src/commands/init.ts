import initPrompt from '../prompts/init.js'
import initService from '../services/init.js'
import {Command, Flags} from '@oclif/core'
import {path, cli, analytics} from '@shopify/cli-kit'

export default class Init extends Command {
  static flags = {
    ...cli.globalFlags,
    name: Flags.string({
      char: 'n',
      env: 'SHOPIFY_FLAG_NAME',
      hidden: false,
    }),
    path: Flags.string({
      char: 'p',
      env: 'SHOPIFY_FLAG_PATH',
      parse: (input, _) => Promise.resolve(path.resolve(input)),
      hidden: false,
    }),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'dependency-manager': Flags.string({
      char: 'd',
      env: 'SHOPIFY_FLAG_DEPENDENCY_MANAGER',
      hidden: false,
      options: ['npm', 'yarn', 'pnpm'],
    }),
    local: Flags.boolean({
      char: 'l',
      env: 'SHOPIFY_FLAG_LOCAL',
      default: false,
      hidden: true,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Init)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()

    const promptAnswers = await initPrompt({
      name: flags.name,
    })

    await initService({
      name: promptAnswers.name,
      dependencyManager: flags['dependency-manager'],
      local: flags.local,
      directory,
    })
    await analytics.reportEvent()
  }

  parseURL(url: string): URL | undefined {
    try {
      return new URL(url)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      return undefined
    }
  }
}
