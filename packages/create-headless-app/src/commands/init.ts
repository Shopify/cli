import initPrompt from '../prompts/init.js'
import initService from '../services/init.js'
import {Flags} from '@oclif/core'
import {path, cli, error, output} from '@shopify/cli-kit'
import Command from '@shopify/cli-kit/node/base-command'

export const InvalidGithubRepository = () => {
  return new error.Abort(
    'Only GitHub repository references are supported. e.g.: https://github.com/Shopify/<repository>/[subpath]#[branch]',
  )
}
export default class Init extends Command {
  static aliases = ['create-headless-app']

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
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()

    const promptAnswers = await initPrompt({
      name: flags.name,
      directory,
    })

    await initService({
      name: promptAnswers.name,
      packageManager: flags['package-manager'],
      local: flags.local,
      directory,
    })
  }
}
