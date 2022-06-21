import {exists, write, read} from './file'
import {findUp, join} from './path'
import {content, token, debug} from './output'

/**
 * Check if user editor is VS Code
 */
export const isVSCode = async (root = process.cwd()) => {
  debug(content`Checking if the directory ${token.path(root)} or any of its parents has a .vscode directory... `)
  const config = await findUp(join(root, '.vscode'), {type: 'directory'})

  if (!config) {
    return false
  }

  return exists(config)
}

/**
 * Add VSCode extension recommendations
 */
export async function addRecommendedExtensions(directory: string, recommendations: string[]) {
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
