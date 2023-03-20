import {UIExtensionSpec} from './ui.js'
import {ThemeExtensionSpec} from './theme.js'
import {GenericSpecification} from '../app/extensions.js'
import {loadUIExtensionSpecificiationsFromPlugins} from '../../private/plugins/extension.js'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import {memoize} from '@shopify/cli-kit/common/function'
import {Config} from '@oclif/core'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {glob} from '@shopify/cli-kit/node/fs'
import {fileURLToPath} from 'url'

export async function loadUIExtensionSpecifications(config: Config): Promise<UIExtensionSpec[]> {
  const local = await loadLocalUIExtensionsSpecifications()
  const plugins = await loadUIExtensionSpecificiationsFromPlugins(config)
  return [...local, ...plugins]
}

export async function loadLocalUIExtensionsSpecifications(): Promise<UIExtensionSpec[]> {
  return memoizedLoadSpecs('ui-specifications')
}

export async function loadThemeSpecifications(): Promise<ThemeExtensionSpec[]> {
  return memoizedLoadSpecs('theme-specifications')
}

/**
 * Load all specifications from the local file system AND plugins
 */
export async function loadExtensionsSpecifications(config: Config): Promise<GenericSpecification[]> {
  const ui = await loadUIExtensionSpecifications(config)
  const theme = await loadThemeSpecifications()
  return [...ui, ...theme]
}

/**
 * Load all specifications ONLY from the local file system
 */
export async function loadLocalExtensionsSpecifications(): Promise<GenericSpecification[]> {
  const ui = await loadLocalUIExtensionsSpecifications()
  const theme = await loadThemeSpecifications()
  return [...ui, ...theme]
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
