// import {visibleTemplates} from '../prompts/init.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import Command from '@shopify/cli-kit/node/base-command'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'
import {exec} from '@shopify/cli-kit/node/system'

export default class Init extends Command {
  static summary = 'Create a new app project'

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
       - <remix|none>
       - Any GitHub repo with optional branch and subpath, e.g., https://github.com/Shopify/<repository>/[subpath]#[branch]`,
      env: 'SHOPIFY_FLAG_TEMPLATE',
    }),
    flavor: Flags.string({
      description: 'Which flavor of the given template to use.',
      env: 'SHOPIFY_FLAG_TEMPLATE_FLAVOR',
    }),
    'package-manager': Flags.string({
      char: 'd',
      env: 'SHOPIFY_FLAG_PACKAGE_MANAGER',
      hidden: false,
      options: ['npm', 'yarn', 'pnpm', 'bun'],
    }),
    local: Flags.boolean({
      char: 'l',
      env: 'SHOPIFY_FLAG_LOCAL',
      default: false,
      hidden: true,
    }),
  }

  async run(): Promise<void> {
    const args = ['exec', '@shopify/create-app', 'init', '--']
    const {flags} = await this.parse(Init)
    if (flags.name) args.push(`--name=${flags.name}`)
    if (flags.path) args.push(`--path=${flags.path}`)
    if (flags.template) args.push(`--template=${flags.template}`)
    if (flags.flavor) args.push(`--flavor=${flags.flavor}`)
    if (flags['package-manager']) args.push(`--package-manager=${flags['package-manager']}`)
    if (flags.local) args.push(`--local`)
    await exec('npm', args, {stdio: 'inherit'})
  }
}
