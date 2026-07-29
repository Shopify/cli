import {addTrustedThemeEnvironment} from '../utilities/theme-airlock/writer.js'
import {ThemeAirlockError} from '../utilities/theme-airlock/types.js'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'

interface ThemeAirlockAddOptions {
  themePath: string
  environment: string
  store: string
  password?: string
}

interface ThemeAirlockAddResult {
  environment: string
  store: string
  configurationPath: string
}

export async function themeAirlockAdd(options: ThemeAirlockAddOptions): Promise<ThemeAirlockAddResult> {
  const environment = options.environment.trim()
  if (!environment) {
    throw new ThemeAirlockError("Environment name to add can't be empty.", 'invalid-environment')
  }

  const store = normalizeStoreFqdn(options.store)
  await ensureAuthenticatedThemes(store, options.password)

  const configuration = await addTrustedThemeEnvironment({
    themePath: options.themePath,
    environment,
    store,
  })

  return {
    environment,
    store: configuration.store,
    configurationPath: configuration.path,
  }
}
