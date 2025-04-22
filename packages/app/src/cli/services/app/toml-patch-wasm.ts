import * as tomlPatch from '@shopify/toml-patch'

type TomlSingleValue = string | number | boolean

type TomlPatchValue = TomlSingleValue | TomlSingleValue[] | undefined

/**
 * Update the TOML content using the WASM module
 * @param tomlContent - The TOML content to update
 * @param patches - An array of tuples, each containing a dotted path and a value
 * @returns The updated TOML content
 */
export async function updateTomlValues(tomlContent: string, patches: [string[], TomlPatchValue][]): Promise<string> {
  return tomlPatch.updateTomlValues(tomlContent, patches)
}
