import {UIExtensionSpec} from './ui.js'
import {FunctionSpec} from './functions.js'
import {ThemeExtensionSpec} from './theme.js'
import {GenericSpecification} from '../app/extensions.js'
import {os, path} from '@shopify/cli-kit'
import {memoize} from 'lodash-es'
import {isShopify} from '@shopify/cli-kit/src/environment/local.js'
import {fileURLToPath} from 'url'

export async function allUISpecifications(): Promise<UIExtensionSpec[]> {
  return memLoadSpecs('ui-specifications')
}

export async function allFunctionSpecifications(): Promise<FunctionSpec[]> {
  return (await memLoadSpecs('function-specifications')).filter((spec) => !spec.gated || isShopify)
}

export async function allThemeSpecifications(): Promise<ThemeExtensionSpec[]> {
  return memLoadSpecs('theme-specifications')
}

export async function allLocalSpecs(): Promise<GenericSpecification[]> {
  const ui = await allUISpecifications()
  const functions = await allFunctionSpecifications()
  const theme = await allThemeSpecifications()
  return [...ui, ...functions, ...theme]
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
