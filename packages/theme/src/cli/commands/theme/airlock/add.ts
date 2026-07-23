import {themeAirlockAdd} from '../../../services/theme-airlock-add.js'
import {themeFlags} from '../../../flags.js'
import {Args, Flags} from '@oclif/core'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {authAliasFlag, globalFlags} from '@shopify/cli-kit/node/cli'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export default class Add extends BaseCommand {
  static baseFlags = authAliasFlag

  static summary = 'Trust a store for this theme project.'

  static args = {
    store: Args.string({
      description: 'Store domain to trust.',
      required: true,
    }),
  }

  static flags = {
    ...globalFlags,
    path: themeFlags.path,
    password: themeFlags.password,
    environment: Flags.string({
      description: 'Environment name to add.',
      env: 'SHOPIFY_FLAG_ENVIRONMENT',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Add)
    const result = await themeAirlockAdd({
      themePath: flags.path,
      environment: flags.environment,
      store: args.store,
      password: flags.password,
    })

    renderSuccess({
      headline: 'Store added to Theme Airlock.',
      body: [
        `Environment: ${result.environment}`,
        `Store: ${result.store}`,
        `Configuration: ${result.configurationPath}`,
      ],
    })
  }
}
