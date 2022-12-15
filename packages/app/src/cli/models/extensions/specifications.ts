import {ExtensionSpec} from './extensions.js'
import {FunctionSpec} from './functions.js'
import {getListOfExtensionSpecs, getListOfFunctionSpecs} from '../../plugins/extension.js'
import {os, path} from '@shopify/cli-kit'
import {memoize} from 'lodash-es'
import {Config} from '@oclif/core'
import {fileURLToPath} from 'url'

/**
 * Load all ExtensionSpecs from plugins and local specs
 */
export async function allExtensionSpecifications(config: Config): Promise<ExtensionSpec[]> {
  const pluginSpecs = await getListOfExtensionSpecs(config)
  const localSpecs = await allLocalExtensionSpecs()
  return [...localSpecs, ...pluginSpecs]
}

/**
 * Load all FunctionSpecs from plugins and local specs
 */
export async function allFunctionSpecifications(config: Config): Promise<FunctionSpec[]> {
  const pluginSpecs = await getListOfFunctionSpecs(config)
  const localSpecs = await allLocalFunctionSpecs()
  return [...localSpecs, ...pluginSpecs]
}

/**
 * Load only local ExtensionSpecs
 */
export async function allLocalExtensionSpecs(): Promise<ExtensionSpec[]> {
  return memLoadSpecs('extension-specifications')
}

/**
 * Load only local FunctionSpecs
 */
export async function allLocalFunctionSpecs(): Promise<FunctionSpec[]> {
  return memLoadSpecs('function-specifications')
}

const memLoadSpecs = memoize(loadSpecs)

async function loadSpecs(directoryName: string) {
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
