import {ExtensionSpec} from './extensions.js'
import {FunctionSpec} from './functions.js'
import {path} from '@shopify/cli-kit'
import {fileURLToPath} from 'url'

let loadedExtensionSpecs: ExtensionSpec[]
let loadedFunctionSpecs: FunctionSpec[]

export async function allExtensionSpecifications(): Promise<ExtensionSpec[]> {
  if (loadedExtensionSpecs) return loadedExtensionSpecs
  const registrations = await loadSpecs('extensions-specifications')
  // eslint-disable-next-line require-atomic-updates
  loadedExtensionSpecs = registrations
  return registrations
}

export async function allFunctionSpecifications(): Promise<FunctionSpec[]> {
  if (loadedFunctionSpecs) return loadedFunctionSpecs
  const registrations = await loadSpecs('function-specifications')
  // eslint-disable-next-line require-atomic-updates
  loadedFunctionSpecs = registrations
  return registrations
}

async function loadSpecs(directoryName: string) {
  const url = path.join(path.dirname(fileURLToPath(import.meta.url)), path.join(directoryName, '*.js'))
  const files = await path.glob(url)
  const promises = files.map((file) => import(file))
  const modules = await Promise.all(promises)
  const specs = modules.map((module) => module.default)
  return specs
}
