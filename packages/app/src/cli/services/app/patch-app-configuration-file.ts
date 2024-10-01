import {addDefaultCommentsToToml} from './write-app-configuration-file.js'
import {readFile, writeFileSync} from '@shopify/cli-kit/node/fs'
import {decodeToml, encodeToml} from '@shopify/cli-kit/node/toml'

/**
 * Updates the app configuration file with the given patch.
 *
 * Only updates the given fields in the patch and leaves the rest of the file unchanged.
 *
 * @param path - The path to the app configuration file.
 * @param patch - The patch to apply to the app configuration file.
 */
export async function patchAppConfigurationFile(path: string, patch: {[key: string]: unknown}) {
  const tomlContents = await readFile(path)
  const configuration = decodeToml(tomlContents)

  const updatedConfig = {...configuration, ...patch}

  const encodedString = encodeToml(updatedConfig)

  const fileContents = addDefaultCommentsToToml(encodedString)

  writeFileSync(path, fileContents)
}
