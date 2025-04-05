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
export async function appHiddenConfigPath(appDirectory: string): Promise<string> {
  const hiddenShopifyFolder = await getOrCreateHiddenShopifyFolder(appDirectory)
  return joinPath(hiddenShopifyFolder, HIDDEN_CONFIG_PATH)
}
