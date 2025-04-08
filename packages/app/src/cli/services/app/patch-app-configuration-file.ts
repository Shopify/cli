import {addDefaultCommentsToToml} from './write-app-configuration-file.js'
import {AppHiddenConfig} from '../../models/app/app.js'
import {deepMergeObjects} from '@shopify/cli-kit/common/object'
import {readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {zod} from '@shopify/cli-kit/node/schema'
import {decodeToml, encodeToml} from '@shopify/cli-kit/node/toml'

export interface PatchTomlOptions {
  path: string
  patch: {[key: string]: unknown}
  schema?: zod.AnyZodObject
}

/**
 * Updates an app configuration file with the given patch.
 *
 * Only updates the given fields in the patch and leaves the rest of the file unchanged.
 * Keeps the same order of the keys as the original file.
 *
 * New keys are always added at the end of the file.
 *
 * @param path - The path to the app configuration file.
 * @param patch - The patch to apply to the app configuration file.
 * @param schema - The schema to validate the patch against. If not provided, the toml will not be validated.
 * @internal Internal function, use setAppConfigValue, unsetAppConfigValue, or setManyAppConfigValues instead
 */
async function patchAppConfigurationFile({path, patch, schema}: PatchTomlOptions) {
  const tomlContents = await readFile(path)
  const configuration = decodeToml(tomlContents)

  // Deep merge the configuration with the patch.
  // Use replaceArrayStrategy to replace the destination array with the source array. (Arrays are not merged)
  const updatedConfig = deepMergeObjects(configuration, patch, replaceArrayStrategy)

  // Re-parse the config with the schema to validate the patch
  // Make every field optional to not crash on tomls that are missing fields.
  const validSchema = schema ?? zod.object({}).passthrough()
  validSchema.partial().parse(updatedConfig)

  let encodedString = encodeToml(updatedConfig)
  encodedString = addDefaultCommentsToToml(encodedString)
  await writeFile(path, encodedString)
}

/**
 * Sets a single value in the app configuration file based on a dotted key path.
 *
 * @param path - The path to the app configuration file.
 * @param keyPath - The dotted key path to set the value at (e.g. 'build.dev_store_url')
 * @param value - The value to set
 * @param schema - The schema to validate the patch against. If not provided, the toml will not be validated.
 */
export async function setAppConfigValue(path: string, keyPath: string, value: unknown, schema?: zod.AnyZodObject) {
  const patch = createPatchFromDottedPath(keyPath, value)
  await patchAppConfigurationFile({path, patch, schema})
}

/**
 * Sets multiple values in the app configuration file.
 *
 * @param path - The path to the app configuration file
 * @param configValues - Array of keyPath and value pairs to set
 * @param schema - The schema to validate the patch against. If not provided, the toml will not be validated.
 *
 * @example
 * ```ts
 * await setManyAppConfigValues('shopify.app.toml', [
 *   { keyPath: 'application_url', value: 'https://example.com' },
 *   { keyPath: 'auth.redirect_urls', value: ['https://example.com/callback'] }
 * ], schema)
 * ```
 */
export async function setManyAppConfigValues(
  path: string,
  configValues: {keyPath: string; value: unknown}[],
  schema?: zod.AnyZodObject,
) {
  const patch = configValues.reduce((acc, {keyPath, value}) => {
    const valuePatch = createPatchFromDottedPath(keyPath, value)
    return deepMergeObjects(acc, valuePatch, replaceArrayStrategy)
  }, {})

  await patchAppConfigurationFile({path, patch, schema})
}

/**
 * Unsets a value in the app configuration file based on a dotted key path.
 *
 * @param path - The path to the app configuration file.
 * @param keyPath - The dotted key path to unset (e.g. 'build.include_config_on_deploy')
 * @param schema - The schema to validate the patch against. If not provided, the toml will not be validated.
 */
export async function unsetAppConfigValue(path: string, keyPath: string, schema?: zod.AnyZodObject) {
  const patch = createPatchFromDottedPath(keyPath, undefined)
  await patchAppConfigurationFile({path, patch, schema})
}

/**
 * Creates a patch object from a dotted key path and a value
 * For example, 'build.dev_store_url' with value 'example.myshopify.com'
 * will create \{ build: \{ dev_store_url: 'example.myshopify.com' \} \}
 */
function createPatchFromDottedPath(keyPath: string, value: unknown): {[key: string]: unknown} {
  const keys = keyPath.split('.')
  if (keys.length === 1) {
    return {[keyPath]: value}
  }

  const obj: {[key: string]: unknown} = {}
  let currentObj = obj

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (key) {
      currentObj[key] = {}
      currentObj = currentObj[key] as {[key: string]: unknown}
    }
  }

  const lastKey = keys[keys.length - 1]
  if (lastKey) {
    currentObj[lastKey] = value
  }

  return obj
}

export function replaceArrayStrategy(_: unknown[], newArray: unknown[]): unknown[] {
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
