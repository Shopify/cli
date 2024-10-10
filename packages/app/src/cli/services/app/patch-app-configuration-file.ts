import {addDefaultCommentsToToml} from './write-app-configuration-file.js'
import {deepMergeObjects} from '@shopify/cli-kit/common/object'
import {readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {zod} from '@shopify/cli-kit/node/schema'
import {decodeToml, encodeToml} from '@shopify/cli-kit/node/toml'

/**
 * Updates the app configuration file with the given patch.
 *
 * Only updates the given fields in the patch and leaves the rest of the file unchanged.
 *
 * @param path - The path to the app configuration file.
 * @param patch - The patch to apply to the app configuration file.
 */
export async function patchAppConfigurationFile(
  path: string,
  patch: {[key: string]: unknown},
  schema: zod.AnyZodObject,
) {
  const tomlContents = await readFile(path)
  const configuration = decodeToml(tomlContents)
  const updatedConfig = deepMergeObjects(configuration, patch)
  // Re-parse the config with the schema to validate the patch and keep the same order in the file
  // Make every field optional to not crash on invalid tomls that are missing fields.
  const validatedConfig = schema.partial().parse(updatedConfig)
  const encodedString = encodeToml(validatedConfig)
  const fileContents = addDefaultCommentsToToml(encodedString)
  await writeFile(path, fileContents)
}
