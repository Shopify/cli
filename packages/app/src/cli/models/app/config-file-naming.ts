import {configurationFileNames} from '../../constants.js'
import {slugify} from '@shopify/cli-kit/common/string'
import {basename} from '@shopify/cli-kit/node/path'

const appConfigurationFileNameRegex = /^shopify\.app(\.[-\w]+)?\.toml$/
export type AppConfigurationFileName = 'shopify.app.toml' | `shopify.app.${string}.toml`

/**
 * Gets the name of the app configuration file (e.g. `shopify.app.production.toml`) based on a provided config name.
 *
 * @param configName - Optional config name to base the file name upon
 * @returns Either the default app configuration file name (`shopify.app.toml`), the given config name (if it matched the valid format), or `shopify.app.<config name>.toml` if it was an arbitrary string
 */
export function getAppConfigurationFileName(configName?: string): AppConfigurationFileName {
  if (!configName) {
    return configurationFileNames.app
  }

  if (isValidFormatAppConfigurationFileName(configName)) {
    return configName
  } else {
    return `shopify.app.${slugify(configName)}.toml`
  }
}

/**
 * Given a path to an app configuration file, extract the shorthand section from the file name.
 *
 * This is undefined for `shopify.app.toml` files, or returns e.g. `production` for `shopify.app.production.toml`.
 */
export function getAppConfigurationShorthand(path: string) {
  const match = basename(path).match(appConfigurationFileNameRegex)
  return match?.[1]?.slice(1)
}

/** Checks if configName is a valid one (`shopify.app.toml`, or `shopify.app.<something>.toml`) */
export function isValidFormatAppConfigurationFileName(configName: string): configName is AppConfigurationFileName {
  if (appConfigurationFileNameRegex.test(configName)) {
    return true
  }
  return false
}
