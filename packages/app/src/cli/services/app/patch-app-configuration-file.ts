import {AppHiddenConfig} from '../../models/app/app.js'
import {deepMergeObjects} from '@shopify/cli-kit/common/object'
import {readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {zod} from '@shopify/cli-kit/node/schema'
import {updateTomlValues} from '@shopify/toml-patch'

export interface PatchTomlOptions {
  path: string
  patch: {[key: string]: unknown}
  schema?: zod.AnyZodObject
}

type TomlPatchValue = string | number | boolean | undefined | string[]

async function patchAppConfigurationFileWithWasm(
  path: string,
  configValues: {keyPath: string; value: TomlPatchValue}[],
) {
  const tomlContents = await readFile(path)
  const updatedConfig = await updateTomlValues(
    tomlContents,
    configValues.map(({keyPath, value}) => [keyPath.split('.'), value]),
  )
  await writeFile(path, updatedConfig)
}

/**
 * Sets a single value in the app configuration file based on a dotted key path.
 *
 * @param path - The path to the app configuration file.
 * @param keyPath - The dotted key path to set the value at (e.g. 'build.dev_store_url')
 * @param value - The value to set
 */
export async function setAppConfigValue(path: string, keyPath: string, value: TomlPatchValue) {
  return patchAppConfigurationFileWithWasm(path, [{keyPath, value}])
}

/**
 * Sets multiple values in the app configuration file.
 *
 * @param path - The path to the app configuration file
 * @param configValues - Array of keyPath and value pairs to set
 *
 * @example
 * ```ts
 * await setManyAppConfigValues('shopify.app.toml', [
 *   { keyPath: 'application_url', value: 'https://example.com' },
 *   { keyPath: 'auth.redirect_urls', value: ['https://example.com/callback'] }
 * ])
 * ```
 */
export async function setManyAppConfigValues(path: string, configValues: {keyPath: string; value: TomlPatchValue}[]) {
  return patchAppConfigurationFileWithWasm(path, configValues)
}

/**
 * Unsets a value in the app configuration file based on a dotted key path.
 *
 * @param path - The path to the app configuration file.
 * @param keyPath - The dotted key path to unset (e.g. 'build.include_config_on_deploy')
 */
export async function unsetAppConfigValue(path: string, keyPath: string) {
  return patchAppConfigurationFileWithWasm(path, [{keyPath, value: undefined}])
}

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
