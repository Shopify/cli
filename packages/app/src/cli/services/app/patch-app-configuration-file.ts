import {addDefaultCommentsToToml} from './write-app-configuration-file.js'
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
 */
export async function patchAppConfigurationFile({path, patch, schema}: PatchTomlOptions) {
  const tomlContents = await readFile(path)
  const configuration = decodeToml(tomlContents)
  const updatedConfig = deepMergeObjects(configuration, patch)

  // Re-parse the config with the schema to validate the patch
  // Make every field optional to not crash on tomls that are missing fields.
  const validSchema = schema ?? zod.object({}).passthrough()
  validSchema.partial().parse(updatedConfig)

  let encodedString = encodeToml(updatedConfig)
  encodedString = addDefaultCommentsToToml(encodedString)
  await writeFile(path, encodedString)
}
