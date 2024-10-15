import {addDefaultCommentsToToml} from './write-app-configuration-file.js'
import {deepMergeObjects} from '@shopify/cli-kit/common/object'
import {readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {zod} from '@shopify/cli-kit/node/schema'
import {decodeToml, encodeToml} from '@shopify/cli-kit/node/toml'

export interface PatchTomlOptions {
  path: string
  patch: {[key: string]: unknown}
  schema?: zod.AnyZodObject
  includeAppDefaultComments?: boolean
}

/**
 * Updates an app/extension configuration file with the given patch.
 *
 * Only updates the given fields in the patch and leaves the rest of the file unchanged.
 *
 * @param path - The path to the app/extension configuration file.
 * @param patch - The patch to apply to the app/extension configuration file.
 * @param schema - The schema to validate the patch against. If not provided, the toml will not be validated.
 * @param includeAppDefaultComments - Include the default comments at the top of the app config file. Only relevant for app config files.
 */
export async function patchTomlConfigurationFile({path, patch, schema, includeAppDefaultComments}: PatchTomlOptions) {
  const tomlContents = await readFile(path)
  const configuration = decodeToml(tomlContents)
  const updatedConfig = deepMergeObjects(configuration, patch)

  // Re-parse the config with the schema to validate the patch and keep the same order in the file
  // Make every field optional to not crash on invalid tomls that are missing fields.
  const validSchema = schema ?? zod.object({}).passthrough()
  const validatedConfig = validSchema.partial().parse(updatedConfig)
  let encodedString = encodeToml(validatedConfig)

  // Only for app config files
  if (includeAppDefaultComments) encodedString = addDefaultCommentsToToml(encodedString)
  await writeFile(path, encodedString)
}
