import {joinPath} from './path.js'
import {mkdirSync, writeFileSync} from 'fs'

const HIDDEN_FOLDER_NAME = '.shopify'
const HIDDEN_CONFIG_PATH = 'project.json'

/**
 * Creates a git ignored hidden .shopify folder in the given app directory, and pass its path to the given callback.
 *
 * @param appDirectory - The directory of the app.
 * @param callback - A callback that receives the path to the hidden folder.
 * @returns The value returned by the callback function.
 */
export function withHiddenShopifyFolderIn<T>(appDirectory: string, callback: (hiddenFolder: string) => T): T {
  const hiddenFolder = joinPath(appDirectory, HIDDEN_FOLDER_NAME)
  mkdirSync(hiddenFolder, {recursive: true})
  writeFileSync(joinPath(hiddenFolder, '.gitignore'), `# Ignore the entire ${HIDDEN_FOLDER_NAME} directory\n*`)

  return callback(hiddenFolder)
}

/**
 * Calls the given callback with the path to the config file in the hidden .shopify folder,
 * ensuring the hidden folder is set up first.
 *
 * @param appDirectory - The directory of the app.
 * @param callback - A callback that receives the path to the hidden config file.
 * @returns The value returned by the callback function.
 */
export function withHiddenConfigPathIn<T>(appDirectory: string, callback: (hiddenConfigPath: string) => T): T {
  return withHiddenShopifyFolderIn(appDirectory, (hiddenFolder) => {
    const hiddenConfigPath = joinPath(hiddenFolder, HIDDEN_CONFIG_PATH)
    return callback(hiddenConfigPath)
  })
}
