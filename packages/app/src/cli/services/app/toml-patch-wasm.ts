import {
  echo_toml as echoTomlWasm,
  update_toml_values as updateTomlValuesWasm,
} from '../../../../assets/wasm/toml_patch/toml_patch.js'

/**
 * Echo the TOML content using the WASM module
 * This function ensures the WASM module is initialized before use
 */
export async function echoToml(tomlContent: string): Promise<string> {
  return echoTomlWasm(tomlContent)
}

type TomlPatchValue = string | number | boolean | undefined

/**
 * Update the TOML content using the WASM module
 * @param tomlContent - The TOML content to update
 * @param patches - An array of tuples, each containing a dotted path and a value
 * @returns The updated TOML content
 */
export async function updateTomlValues(tomlContent: string, patches: [string, TomlPatchValue][]): Promise<string> {
  const paths = patches.map(([path, _]) => path).join(',')
  const values = patches.map(([_, value]) => value?.toString() ?? '$undefined').join(',')
  return updateTomlValuesWasm(tomlContent, paths, values)
}
