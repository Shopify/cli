import {ExtensionSpecification} from './specification.js'
import {loadUIExtensionSpecificationsFromPlugins} from '../../private/plugins/extension.js'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import {memoize} from '@shopify/cli-kit/common/function'
import {Config} from '@oclif/core'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {glob} from '@shopify/cli-kit/node/fs'
import {fileURLToPath} from 'url'

/**
 * Load all specifications from the local file system AND plugins
 */
export async function loadLocalExtensionsSpecifications(config: Config): Promise<ExtensionSpecification[]> {
  const local = await loadFSExtensionsSpecifications()
  const plugins = await loadUIExtensionSpecificationsFromPlugins(config)
  return [...local, ...plugins]
}

/**
 * Load all specifications ONLY from the local file system
 */
export async function loadFSExtensionsSpecifications(): Promise<ExtensionSpecification[]> {
  return memoizedLoadSpecs('specifications')
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
