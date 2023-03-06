import initPrompt, {templateURLMap} from '../prompts/init.js'
import initService from '../services/init.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import Command from '@shopify/cli-kit/node/base-command'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
// eslint-disable-next-line node/prefer-global/url
import {URL} from 'url'

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
      parse: async (input) => resolvePath(input),
      default: async () => cwd(),
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

    this.validateTemplateValue(flags.template)

    const promptAnswers = await initPrompt({
      name: flags.name,
      template: flags.template,
      directory: flags.path,
    })

    await initService({
      name: promptAnswers.name,
      packageManager: flags['package-manager'],
      template: promptAnswers.template,
      local: flags.local,
      directory: flags.path,
    })
  }

  validateTemplateValue(template: string | undefined) {
    if (!template) {
      return
    }

    const url = this.parseURL(template)
    if (url && url.origin !== 'https://github.com')
      throw new AbortError(
        'Only GitHub repository references are supported, ' +
          'e.g., https://github.com/Shopify/<repository>/[subpath]#[branch]',
      )
    if (!url && !Object.keys(templateURLMap).includes(template))
      throw new AbortError(
        outputContent`Only ${Object.keys(templateURLMap)
          .map((alias) => outputContent`${outputToken.yellow(alias)}`.value)
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
