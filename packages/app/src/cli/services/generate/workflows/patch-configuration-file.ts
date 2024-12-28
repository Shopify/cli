import {deepMergeObjects} from '@shopify/cli-kit/common/object'
import {readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {zod} from '@shopify/cli-kit/node/schema'
import {decodeToml, encodeToml} from '@shopify/cli-kit/node/toml'

export interface PatchTomlOptions {
  path: string
  patch: {[key: string]: unknown}
  schema?: zod.AnyZodObject
}

function mergeArrayStrategy(existingArray: unknown[], newArray: unknown[]): unknown[] {
  if (
    existingArray.length > 0 &&
    existingArray[0] &&
    typeof existingArray[0] === 'object' &&
    newArray[0] &&
    typeof newArray[0] === 'object'
  ) {
    return [{...(existingArray[0] as object), ...(newArray[0] as object)}]
  }
  return newArray
}

export async function patchConfigurationFile({path, patch}: PatchTomlOptions) {
  const tomlContents = await readFile(path)
  const configuration = decodeToml(tomlContents)

  // Deep merge with custom array strategy
  const updatedConfig = deepMergeObjects(configuration, patch, mergeArrayStrategy)

  const encodedString = encodeToml(updatedConfig)
  await writeFile(path, encodedString)
}
