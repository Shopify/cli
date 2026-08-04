import {joinPath} from './path.js'
import {mkdir, writeFile, fileExists} from './fs.js'
import {outputDebug, outputContent, outputToken} from './output.js'

const HIDDEN_FOLDER_NAME = '.shopify'

/**
 * Gets the path to the hidden .shopify folder for a given project directory.
 * Creates the folder if it doesn't exist.
 *
 * @param directory - The directory of the project.
 * @returns The path to the created hidden folder.
 */
export async function getOrCreateHiddenShopifyFolder(directory: string): Promise<string> {
  const hiddenFolder = joinPath(directory, HIDDEN_FOLDER_NAME)
  const gitignorePath = joinPath(hiddenFolder, '.gitignore')

  if (!(await fileExists(hiddenFolder))) {
    outputDebug(outputContent`Creating hidden .shopify folder at ${outputToken.path(hiddenFolder)}...`)
    await mkdir(hiddenFolder)
  }

  if (!(await fileExists(gitignorePath))) {
    outputDebug(outputContent`Creating .gitignore in ${outputToken.path(hiddenFolder)}...`)
    await writeFile(gitignorePath, `# Ignore the entire ${HIDDEN_FOLDER_NAME} directory\n*`)
  }

  return hiddenFolder
}
