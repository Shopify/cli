import initPrompt, {templateURLMap} from '../prompts/init.js'
import initService from '../services/init.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {path, error, output} from '@shopify/cli-kit'
import Command from '@shopify/cli-kit/node/base-command'

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
      parse: (input, _) => Promise.resolve(path.resolve(input)),
      hidden: false,
    }),
    template: Flags.string({
      description: `The app template. Accepts one of the following:
       - <${Object.keys(templateURLMap).join('|')}>
       - Any GitHub repo with optional branch and subpath, e.g., https://github.com/Shopify/<repository>/[subpath]#[branch]`,
      env: 'SHOPIFY_FLAG_TEMPLATE',
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

    this.validateTemplateValue(flags.template)

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

  validateTemplateValue(template: string | undefined) {
    if (!template) {
      return
    }

    const url = this.parseURL(template)
    if (url && url.origin !== 'https://github.com')
      throw new error.Abort(
        'Only GitHub repository references are supported, ' +
          'e.g., https://github.com/Shopify/<repository>/[subpath]#[branch]',
      )
    if (!url && !Object.keys(templateURLMap).includes(template))
      throw new error.Abort(
        output.content`Only ${Object.keys(templateURLMap)
          .map((alias) => output.content`${output.token.yellow(alias)}`.value)
          .join(', ')} template aliases are supported`,
      )
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
