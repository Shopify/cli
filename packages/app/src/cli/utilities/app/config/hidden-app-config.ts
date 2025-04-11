import {writeFile, fileExists} from '@shopify/cli-kit/node/fs'
import {getOrCreateHiddenShopifyFolder} from '@shopify/cli-kit/node/hidden-folder'
import {joinPath} from '@shopify/cli-kit/node/path'

const HIDDEN_CONFIG_PATH = 'project.json'
/**
 * Returns the path to the config file in the hidden .shopify folder.
 * Ensures the hidden folder is set up first.
 *
 * @param appDirectory - The directory of the app.
 * @returns The path to the hidden config file.
 */
export async function getOrCreateAppConfigHiddenPath(appDirectory: string): Promise<string> {
  const hiddenShopifyFolder = await getOrCreateHiddenShopifyFolder(appDirectory)
  const hiddenConfigPath = joinPath(hiddenShopifyFolder, HIDDEN_CONFIG_PATH)
  const configPathExists = await fileExists(hiddenConfigPath)
  if (!configPathExists) await writeFile(hiddenConfigPath, JSON.stringify({}))
  return hiddenConfigPath
}
