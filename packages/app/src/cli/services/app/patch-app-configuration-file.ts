import {AppHiddenConfig} from '../../models/app/app.js'
import {deepMergeObjects} from '@shopify/cli-kit/common/object'
import {readFile, writeFile} from '@shopify/cli-kit/node/fs'

function replaceArrayStrategy(_: unknown[], newArray: unknown[]): unknown[] {
  return newArray
}

export async function patchAppHiddenConfigFile(path: string, clientId: string, config: AppHiddenConfig) {
  let configuration: {[key: string]: unknown} = {}
  try {
    const jsonContents = await readFile(path)
    configuration = JSON.parse(jsonContents)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // Do nothing if the file doesn't exist or can't be loaded
  }
  const patch = {[clientId]: config}
  const updatedConfig = deepMergeObjects(configuration, patch, replaceArrayStrategy)
  await writeFile(path, JSON.stringify(updatedConfig, null, 2))
}
