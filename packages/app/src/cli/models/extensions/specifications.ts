import {UIExtensionSpec} from './ui.js'
import {FunctionSpec} from './functions.js'
import {ThemeExtensionSpec} from './theme.js'
import {ConfigurationExtensionSpec} from './configurations.js'
import {GenericSpecification} from '../app/extensions.js'
import {
  loadUIExtensionSpecificiationsFromPlugins,
  loadFunctionSpecificationsFromPlugins,
  loadConfigurationExtensionSpecificationsFromPlugins,
} from '../../private/plugins/extension.js'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import {memoize} from '@shopify/cli-kit/common/function'
import {Config} from '@oclif/core'
import {isShopify} from '@shopify/cli-kit/node/context/local'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {glob} from '@shopify/cli-kit/node/fs'
import {fileURLToPath} from 'url'

export async function loadUIExtensionSpecifications(config: Config): Promise<UIExtensionSpec[]> {
  const local = await loadLocalUIExtensionsSpecifications()
  const plugins = await loadUIExtensionSpecificiationsFromPlugins(config)
  return [...local, ...plugins]
}

export async function loadFunctionSpecifications(config: Config): Promise<FunctionSpec[]> {
  const local = await loadLocalFunctionSpecifications()
  const plugins = await loadFunctionSpecificationsFromPlugins(config)
  return [...local, ...plugins]
}

export async function loadConfigurationExtensionSpecifications(config: Config): Promise<ConfigurationExtensionSpec[]> {
  const local = await loadLocalConfigurationExtensionsSpecifications()
  const plugins = await loadConfigurationExtensionSpecificationsFromPlugins(config)
  return [...local, ...plugins]
}

export async function loadLocalUIExtensionsSpecifications(): Promise<UIExtensionSpec[]> {
  return memoizedLoadSpecs('ui-specifications')
}

export async function loadLocalFunctionSpecifications(): Promise<FunctionSpec[]> {
  const isShopifyUser = await isShopify()
  return (await memoizedLoadSpecs('function-specifications')).filter((spec) => !spec.gated || isShopifyUser)
}

export async function loadThemeSpecifications(): Promise<ThemeExtensionSpec[]> {
  return memoizedLoadSpecs('theme-specifications')
}

export async function loadLocalConfigurationExtensionsSpecifications(): Promise<ConfigurationExtensionSpec[]> {
  return memoizedLoadSpecs('configuration-extension-specifications')
}

/**
 * Load all specifications from the local file system AND plugins
 */
export async function loadExtensionsSpecifications(config: Config): Promise<GenericSpecification[]> {
  const ui = await loadUIExtensionSpecifications(config)
  const functions = await loadFunctionSpecifications(config)
  const theme = await loadThemeSpecifications()
  const configurations = await loadConfigurationExtensionSpecifications(config)
  return [...ui, ...functions, ...theme, ...configurations]
}

/**
 * Load all specifications ONLY from the local file system
 */
export async function loadLocalExtensionsSpecifications(): Promise<GenericSpecification[]> {
  const ui = await loadLocalUIExtensionsSpecifications()
  const functions = await loadLocalFunctionSpecifications()
  const theme = await loadThemeSpecifications()
  const configurations = await loadLocalConfigurationExtensionsSpecifications()
  return [...ui, ...functions, ...theme, ...configurations]
}

const memoizedLoadSpecs = memoize(loadSpecifications)

async function loadSpecifications(directoryName: string) {
  /**
   * When running tests, "await import('.../spec..ts')" is handled by Vitest which does
   * transform the TS module into a JS one before loading it. Hence the inclusion of .ts
   * in the list of files.
   */
  const url = joinPath(dirname(fileURLToPath(import.meta.url)), joinPath(directoryName, '*.{js,ts}'))
  let files = await glob(url, {ignore: ['**.d.ts', '**.test.ts']})

  // From Node 18, all windows paths must start with file://
  const {platform} = platformAndArch()
  if (platform === 'windows') {
    files = files.map((file) => `file://${file}`)
  }

  const promises = files.map((file) => import(file))
  const modules = await Promise.all(promises)
  const specs = modules.map((module) => module.default)
  return specs
}
