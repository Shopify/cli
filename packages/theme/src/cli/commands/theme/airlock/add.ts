import {addTrustedThemeEnvironment} from '../../../utilities/theme-airlock/writer.js'
import {ThemeAirlockError} from '../../../utilities/theme-airlock/types.js'
import {themeFlags} from '../../../flags.js'
import {Args, Flags} from '@oclif/core'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {authAliasFlag, globalFlags} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
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
    const environment = flags.environment.trim()
    if (!environment) {
      throw new ThemeAirlockError("Environment name to add can't be empty.", 'invalid-environment')
    }

    const store = normalizeStoreFqdn(args.store)
    await ensureAuthenticatedThemes(store, flags.password)

    const result = await addTrustedThemeEnvironment({
      themePath: flags.path,
      environment,
      store,
    })

    renderSuccess({
      headline: 'Store added to Theme Airlock.',
      body: [`Environment: ${environment}`, `Store: ${result.store}`, `Configuration: ${result.path}`],
    })
  }
}
