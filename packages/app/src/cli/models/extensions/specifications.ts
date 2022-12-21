import {UIExtensionSpec} from './ui.js'
import {FunctionSpec} from './functions.js'
import {ThemeExtensionSpec} from './theme.js'
import {GenericSpecification} from '../app/extensions.js'
import {getListOfExtensionSpecs, getListOfFunctionSpecs} from '../../plugins/extension.js'
import {os, path, environment} from '@shopify/cli-kit'
import {memoize} from 'lodash-es'
import {Config} from '@oclif/core'
import {fileURLToPath} from 'url'

export async function allUISpecifications(config: Config): Promise<UIExtensionSpec[]> {
  const local = await allLocalUISpecifications()
  const plugins = await getListOfExtensionSpecs(config)
  return [...local, ...plugins]
}

export async function allFunctionSpecifications(config: Config): Promise<FunctionSpec[]> {
  const local = await allLocalFunctionSpecifications()
  const plugins = await getListOfFunctionSpecs(config)
  return [...local, ...plugins]
}

export async function allLocalUISpecifications(): Promise<UIExtensionSpec[]> {
  return memLoadSpecs('ui-specifications')
}

export async function allLocalFunctionSpecifications(): Promise<FunctionSpec[]> {
  return (await memLoadSpecs('function-specifications')).filter((spec) => !spec.gated || environment.local.isShopify())
}

export async function loadThemeSpecifications(): Promise<ThemeExtensionSpec[]> {
  return memLoadSpecs('theme-specifications')
}

export async function allSpecifications(config: Config): Promise<GenericSpecification[]> {
  const ui = await allUISpecifications(config)
  const functions = await allFunctionSpecifications(config)
  const theme = await loadThemeSpecifications()
  return [...ui, ...functions, ...theme]
}

export async function allLocalSpecs(): Promise<GenericSpecification[]> {
  const ui = await allLocalUISpecifications()
  const functions = await allLocalFunctionSpecifications()
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
