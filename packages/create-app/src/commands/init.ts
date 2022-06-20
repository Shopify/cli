import initPrompt, {templateURLMap} from '../prompts/init'
import initService from '../services/init'
import {Command, Flags} from '@oclif/core'
import {path, cli, analytics, error, output} from '@shopify/cli-kit'

const InvalidGithubRepository = () => {
  return new error.Abort(
    'Only GitHub repository references are supported. e.g.: https://github.com/Shopify/<repository>/[subpath]#[branch]',
  )
}

const UnsupportedTemplateAlias = () => {
  return new error.Abort(
    output.content`Only ${Object.keys(templateURLMap)
      .map((alias) => output.content`${output.token.yellow(alias)}`.value)
      .join(', ')} template aliases are supported`,
  )
}
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
      description: `The app template. Accepts one of the following:
       - <${Object.keys(templateURLMap).join('|')}>
       - Any GitHub repo with optional branch and subpath eg: https://github.com/Shopify/<repository>/[subpath]#[branch]`,
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

    this.validateTemplateValue(flags.template)

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
    await this.reportEvent()
  }

  async reportEvent(): Promise<void> {
    const commandIndex = process.argv.indexOf('init')
    const args = process.argv.slice(commandIndex + 1)
    await analytics.reportEvent('create-app', args)
  }

  validateTemplateValue(template: string | undefined) {
    if (!template) {
      return
    }

    const url = this.parseURL(template)
    if (url && url.origin !== 'https://github.com') throw InvalidGithubRepository()
    if (!url && !Object.keys(templateURLMap).includes(template)) throw UnsupportedTemplateAlias()
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
