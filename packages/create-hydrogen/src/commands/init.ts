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
      description: 'The name of the Hydrogen app.',
      char: 'n',
      env: 'SHOPIFY_FLAG_NAME',
      hidden: false,
    }),
    template: Flags.string({
      description:
        'The template to use. Can either be a Shopify template name (hello-world or demo-store) or a custom URL to any template.',
      char: 't',
      env: 'SHOPIFY_FLAG_TEMPLATE',
      hidden: false,
    }),
    ts: Flags.boolean({
      description: 'Set the language of the template to Typescript instead of Javascript.',
      env: 'SHOPIFY_FLAG_LANGUAGE',
      hidden: false,
    }),
    path: Flags.string({
      description: 'The path to the directory where the Hydrogen app will be created.',
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
    'shopify-cli-version': Flags.string({
      description: 'The version of the Shopify CLI to use.',
      char: 's',
      env: 'SHOPIFY_FLAG_SHOPIFY_CLI_VERSION',
      hidden: false,
    }),
    'hydrogen-version': Flags.string({
      description: 'The version of Hydrogen to use.',
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
      language: flags.ts ? 'ts' : undefined,
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
