import {exists, write, read} from '../../file.js'
import {findUp, join} from '../../path.js'
import {content, token, debug} from '../../output.js'

/**
 * Check if user editor is VS Code.
 *
 * @param root - Root directory to start searching for .vscode directory.
 * @returns True if user editor is VS Code.
 */
export async function isVSCode(root = process.cwd()): Promise<boolean> {
  debug(content`Checking if the directory ${token.path(root)} or any of its parents has a .vscode directory... `)
  const config = await findUp(join(root, '.vscode'), {type: 'directory'})

  if (!config) {
    return false
  }

  return exists(config)
}

/**
 * Add VSCode extension recommendations.
 *
 * @param directory - Directory that contains the .vscode folder.
 * @param recommendations - List of VSCode extensions to recommend.
 */
export async function addRecommendedExtensions(directory: string, recommendations: string[]): Promise<void> {
  debug(content`Adding VSCode recommended extensions at ${token.path(directory)}:
${token.json(recommendations)}
  `)
  const extensionsPath = join(directory, '.vscode/extensions.json')

  if (await isVSCode(directory)) {
    let originalExtensionsJson = {recommendations: []}
    if (await exists(extensionsPath)) {
      const originalExtensionsFile = await read(extensionsPath)
      originalExtensionsJson = JSON.parse(originalExtensionsFile)
    }
    const newExtensionsJson = {
      ...originalExtensionsJson,
      recommendations: [...originalExtensionsJson.recommendations, ...recommendations],
    }
    await write(extensionsPath, JSON.stringify(newExtensionsJson, null, 2))
  }
}
