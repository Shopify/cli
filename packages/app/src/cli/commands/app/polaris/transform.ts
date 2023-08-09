import {appFlags} from '../../../flags.js'
import {transform} from '../../../services/transform.js'
import Command from '../../../utilities/app-command.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class Transform extends Command {
  static description = 'Update your Polaris app using code transformations.'
  static flags = {
    ...globalFlags,
    ...appFlags,
    include: Flags.string({
      hidden: false,
      description: 'Files, directory, or glob path to transform',
      env: 'SHOPIFY_FLAG_INCLUDE',
    }),
    package: Flags.string({
      hidden: true,
      description: 'The package which the transform is related',
      env: 'SHOPIFY_FLAG_PACKAGE',
    }),
    transform: Flags.string({
      hidden: false,
      description: 'The name of the transform to apply',
      env: 'SHOPIFY_FLAG_TRANSFORM',
      char: 't',
    }),
    'dry-run': Flags.boolean({
      hidden: false,
      description: 'Do a dry-run, no code will be edited',
      env: 'SHOPIFY_FLAG_DRY',
      default: false,
      char: 'd',
    }),
    print: Flags.boolean({
      hidden: false,
      description: 'Print the changed output for comparison',
      env: 'SHOPIFY_FLAG_PRINT',
      default: false,
    }),
    force: Flags.boolean({
      hidden: false,
      description: 'Bypass Git safety checks and forcibly run transform',
      env: 'SHOPIFY_FLAG_FORCE',
      default: false,
      char: 'f',
    }),
    'transform-options': Flags.string({
      hidden: false,
      description: 'Options to pass to the transform',
      env: 'SHOPIFY_FLAG_TRANSFORM_OPTIONS',
      default: '{}',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Transform)
    await transform({
      path: flags.path,
      include: flags.include,
      package: flags.package,
      transform: flags.transform,
      dryRun: flags['dry-run'],
      print: flags.print,
      force: flags.force,
      verbose: flags.verbose,
      transformOptions: flags['transform-options'],
    })
  }
}
