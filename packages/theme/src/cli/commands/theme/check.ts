import {themeFlags} from '../../flags.js'
import Command from '@shopify/cli-kit/node/base-command'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {cli, path} from '@shopify/cli-kit'
import {Flags} from '@oclif/core'

export default class Check extends Command {
  static description = 'Validate the theme'

  static flags = {
    ...cli.globalFlags,
    ...themeFlags,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'auto-correct': Flags.boolean({
      char: 'a',
      required: false,
      description: 'Automatically fix offenses',
      env: 'SHOPIFY_FLAG_AUTO_CORRECT',
    }),
    category: Flags.string({
      char: 'c',
      required: false,
      description: `Only run this category of checks
Runs checks matching all categories when specified more than once`,
      env: 'SHOPIFY_FLAG_CATEGORY',
    }),
    config: Flags.string({
      char: 'C',
      required: false,
      description: `Use the config provided, overriding .theme-check.yml if present
Use :theme_app_extension to use default checks for theme app extensions`,
      env: 'SHOPIFY_FLAG_CONFIG',
    }),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'exclude-category': Flags.string({
      char: 'x',
      required: false,
      description: `Exclude this category of checks
Excludes checks matching any category when specified more than once`,
      env: 'SHOPIFY_FLAG_EXCLUDE_CATEGORY',
    }),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'fail-level': Flags.string({
      required: false,
      description: 'Minimum severity for exit with error code',
      env: 'SHOPIFY_FLAG_FAIL_LEVEL',
      options: ['error', 'suggestion', 'style'],
    }),
    init: Flags.boolean({
      required: false,
      description: 'Generate a .theme-check.yml file',
      env: 'SHOPIFY_FLAG_INIT',
    }),
    list: Flags.boolean({
      required: false,
      description: 'List enabled checks',
      env: 'SHOPIFY_FLAG_LIST',
    }),
    output: Flags.string({
      char: 'o',
      required: false,
      description: 'The output format to use',
      env: 'SHOPIFY_FLAG_OUTPUT',
      options: ['text', 'json'],
      default: 'text',
    }),
    print: Flags.boolean({
      required: false,
      description: 'Output active config to STDOUT',
      env: 'SHOPIFY_FLAG_PRINT',
    }),
    version: Flags.boolean({
      char: 'v',
      required: false,
      description: 'Print Theme Check version',
      env: 'SHOPIFY_FLAG_VERSION',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Check)
    const passThroughFlags: string[] = []
    for (const [label, value] of Object.entries(flags)) {
      if (label === 'path') {
        continue
      } else if (typeof value === 'boolean') {
        passThroughFlags.push(`--${label}`)
      } else {
        passThroughFlags.push(`--${label}=${value}`)
      }
    }
    await execCLI2(['theme', 'check', ...passThroughFlags], {directory: flags.path})
  }
}
