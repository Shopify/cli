import {fileExists, writeFile, readFile, findPathUp} from './fs.js'
import {joinPath, cwd} from './path.js'
import {outputContent, outputToken, outputDebug} from '../../public/node/output.js'

/**
 * Check if user editor is VS Code.
 *
 * @param root - Root directory to start searching for .vscode directory.
 * @returns True if user editor is VS Code.
 */
export async function isVSCode(root = cwd()): Promise<boolean> {
  outputDebug(
    outputContent`Checking if the directory ${outputToken.path(
      root,
    )} or any of its parents has a .vscode directory... `,
  )
  const config = await findPathUp(joinPath(root, '.vscode'), {type: 'directory'})

  if (!config) {
    return false
  }

  return fileExists(config)
}

/**
 * Add VSCode extension recommendations.
 *
 * @param directory - Directory that contains the .vscode folder.
 * @param recommendations - List of VSCode extensions to recommend.
 */
export async function addRecommendedExtensions(directory: string, recommendations: string[]): Promise<void> {
  outputDebug(outputContent`Adding VSCode recommended extensions at ${outputToken.path(directory)}:
${outputToken.json(recommendations)}
  `)
  const extensionsPath = joinPath(directory, '.vscode/extensions.json')

  if (await isVSCode(directory)) {
    let originalExtensionsJson = {recommendations: []}
    if (await fileExists(extensionsPath)) {
      const originalExtensionsFile = await readFile(extensionsPath)
      originalExtensionsJson = JSON.parse(originalExtensionsFile)
    }
    const newExtensionsJson = {
      ...originalExtensionsJson,
      recommendations: [...originalExtensionsJson.recommendations, ...recommendations],
    }
    await writeFile(extensionsPath, JSON.stringify(newExtensionsJson, null, 2))
  }
}
