import {UIExtensionSpec} from './ui.js'
import {FunctionSpec} from './functions.js'
import {ThemeExtensionSpec} from './theme.js'
import {GenericSpecification} from '../app/extensions.js'
import {
  loadUIExtensionSpecificiationsFromPlugins,
  loadFunctionSpecificationsFromPlugins,
} from '../../public/plugins/extension.js'
import {os, path, environment} from '@shopify/cli-kit'
import {memoize} from 'lodash-es'
import {Config} from '@oclif/core'
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

export async function loadLocalUIExtensionsSpecifications(): Promise<UIExtensionSpec[]> {
  return memLoadSpecs('ui-specifications')
}

export async function loadLocalFunctionSpecifications(): Promise<FunctionSpec[]> {
  return (await memLoadSpecs('function-specifications')).filter((spec) => !spec.gated || environment.local.isShopify())
}

export async function loadThemeSpecifications(): Promise<ThemeExtensionSpec[]> {
  return memLoadSpecs('theme-specifications')
}

/**
 * Load all specifications from the local file system AND plugins
 */
export async function loadExtensionsSpecifications(config: Config): Promise<GenericSpecification[]> {
  const ui = await loadUIExtensionSpecifications(config)
  const functions = await loadFunctionSpecifications(config)
  const theme = await loadThemeSpecifications()
  return [...ui, ...functions, ...theme]
}

/**
 * Load all specifications ONLY from the local file system
 */
export async function loadLocalExtensionsSpecifications(): Promise<GenericSpecification[]> {
  const ui = await loadLocalUIExtensionsSpecifications()
  const functions = await loadLocalFunctionSpecifications()
  const theme = await loadThemeSpecifications()
  return [...ui, ...functions, ...theme]
}

const memLoadSpecs = memoize(loadSpecifications)

async function loadSpecifications(directoryName: string) {
  /**
   * When running tests, "await import('.../spec..ts')" is handled by Vitest which does
   * transform the TS module into a JS one before loading it. Hence the inclusion of .ts
   * in the list of files.
   */
  const url = path.join(path.dirname(fileURLToPath(import.meta.url)), path.join(directoryName, '*.{js,ts}'))
  let files = await path.glob(url, {ignore: ['**.d.ts', '**.test.ts']})

  // From Node 18, all windows paths must start with file://
  const {platform} = os.platformAndArch()
  if (platform === 'windows') {
    files = files.map((file) => `file://${file}`)
  }

  const promises = files.map((file) => import(file))
  const modules = await Promise.all(promises)
  const specs = modules.map((module) => module.default)
  return specs
}
