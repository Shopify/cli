import {Command, Flags} from '@oclif/core'
import {path} from '@shopify/cli-kit'
import {DependencyManager} from '@shopify/cli-kit/src/dependency'

import initPrompt from '../prompts/init'
import initService from '../services/init'

export default class Init extends Command {
  static flags = {
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
    'dependency-manager': Flags.string({
      char: 'd',
      env: 'SHOPIFY_FLAG_DEPENDENCY_MANAGER',
      hidden: false,
      options: ['npm', 'yarn', 'pnpm'],
    }),
    'shopify-cli-version': Flags.string({
      char: 's',
      env: 'SHOPIFY_FLAG_SHOPIFY_CLI_VERSION',
      hidden: true,
    }),
    'shopify-cli-kit-version': Flags.string({
      char: 's',
      env: 'SHOPIFY_FLAG_SHOPIFY_CLI_KIT_VERSION',
      hidden: true,
    }),
    'shopify-app-version': Flags.string({
      char: 'a',
      env: 'SHOPIFY_FLAG_SHOPIFY_APP_VERSION',
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
      shopifyCliVersion: flags['shopify-cli-version'],
      shopifyAppVersion: flags['shopify-app-version'],
      shopifyCliKitVersion: flags['shopify-cli-kit-version'],
      directory,
    })
  }
}
