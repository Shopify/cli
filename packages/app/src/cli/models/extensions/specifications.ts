import {ExtensionSpec} from './extensions.js'
import {FunctionSpec} from './functions.js'
import {os, path} from '@shopify/cli-kit'
import {memoize} from 'lodash-es'
import {fileURLToPath} from 'url'

export async function allExtensionSpecifications(): Promise<ExtensionSpec[]> {
  return memLoadSpecs('extension-specifications')
}

export async function allFunctionSpecifications(): Promise<FunctionSpec[]> {
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
