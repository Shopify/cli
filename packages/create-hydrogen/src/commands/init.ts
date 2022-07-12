import initPrompt from '../prompts/init.js'
import initService from '../services/init.js'
import {path, cli} from '@shopify/cli-kit'
import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'

export default class Init extends Command {
  static aliases = ['create-hydrogen']

  static flags = {
    ...cli.globalFlags,
    name: Flags.string({
      char: 'n',
      env: 'SHOPIFY_FLAG_NAME',
      hidden: false,
    }),
    template: Flags.string({
      char: 't',
      env: 'SHOPIFY_FLAG_TEMPLATE',
      hidden: false,
    }),
    path: Flags.string({
      char: 'p',
      env: 'SHOPIFY_FLAG_PATH',
      parse: (input, _) => Promise.resolve(path.resolve(input)),
      hidden: false,
    }),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'package-manager': Flags.string({
      char: 'd',
      env: 'SHOPIFY_FLAG_PACKAGE_MANAGER',
      hidden: false,
      options: ['npm', 'yarn', 'pnpm'],
    }),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'shopify-cli-version': Flags.string({
      char: 's',
      env: 'SHOPIFY_FLAG_SHOPIFY_CLI_VERSION',
      hidden: false,
    }),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'hydrogen-version': Flags.string({
      char: 'h',
      env: 'SHOPIFY_FLAG_HYDROGEN_VERSION',
      hidden: false,
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
      template: promptAnswers.template,
      packageManager: flags['package-manager'],
      shopifyCliVersion: flags['shopify-cli-version'],
      hydrogenVersion: flags['hydrogen-version'],
      directory,
      local: flags.local,
    })
  }
}
