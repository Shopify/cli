import initPrompt, {templates} from '../prompts/init.js'
import initService from '../services/init.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import Command from '@shopify/cli-kit/node/base-command'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'

export default class Init extends Command {
  static aliases = ['create-app']

  static flags = {
    ...globalFlags,
    name: Flags.string({
      char: 'n',
      env: 'SHOPIFY_FLAG_NAME',
      hidden: false,
    }),
    path: Flags.string({
      char: 'p',
      env: 'SHOPIFY_FLAG_PATH',
      parse: (input, _) => Promise.resolve(resolvePath(input)),
      hidden: false,
    }),
    template: Flags.string({
      description: 'The Shop Mini template',
      options: templates.map((template) => template.value),
      env: 'SHOPIFY_FLAG_TEMPLATE',
      required: false,
    }),
    'package-manager': Flags.string({
      char: 'd',
      env: 'SHOPIFY_FLAG_PACKAGE_MANAGER',
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
    const directory = flags.path ? resolvePath(flags.path) : cwd()

    const promptAnswers = await initPrompt({
      name: flags.name,
      template: flags.template,
      directory,
    })

    await initService({
      name: promptAnswers.name,
      packageManager: flags['package-manager'],
      template: promptAnswers.template,
      local: flags.local,
      directory,
    })
  }
}
