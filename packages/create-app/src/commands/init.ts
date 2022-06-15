import initPrompt from '../prompts/init'
import initService from '../services/init'
import {Command, Flags} from '@oclif/core'
import {path, cli} from '@shopify/cli-kit'

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
    template: Flags.string({
      description:
        'The app template. Accepts any GitHub repo with optional branch and subpath. Eg, --template https://github.com/Shopify/<repository>/[subpath]#[branch]',
      env: 'SHOPIFY_FLAG_TEMPLATE',
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
      template: flags.template,
    })
    await initService({
      name: promptAnswers.name,
      dependencyManager: flags['dependency-manager'],
      template: promptAnswers.template,
      local: flags.local,
      directory,
    })
  }
}
