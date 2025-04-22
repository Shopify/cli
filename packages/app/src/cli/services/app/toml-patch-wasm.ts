import * as tomlPatch from '@shopify/toml-patch'

type TomlSingleValue = string | number | boolean | undefined

function forPatch(value: TomlSingleValue): string {
  return value?.toString() ?? '$undefined'
}

type TomlPatchValue = TomlSingleValue | TomlSingleValue[]

/**
 * Update the TOML content using the WASM module
 * @param tomlContent - The TOML content to update
 * @param patches - An array of tuples, each containing a dotted path and a value
 * @returns The updated TOML content
 */
export async function updateTomlValues(tomlContent: string, patches: [string[], TomlPatchValue][]): Promise<string> {
  const preparedPatches = patches.map(([path, value]) => {
    if (Array.isArray(value)) {
      return tomlPatch.patchArrayValues(path, value.map(forPatch))
    } else {
      return tomlPatch.patchSingleValue(path, forPatch(value))
    }
  })

  return tomlPatch.updateTomlValues(tomlContent, preparedPatches)
}
