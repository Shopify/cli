import {joinPath} from '@shopify/cli-kit/node/path'
import {glob, readFile} from '@shopify/cli-kit/node/fs'

/**
 * Loads the schema from the partner defined file.
 */
export const loadSchemaFromPath = async (extensionPath: string, patchPath: string | undefined) => {
  if (!patchPath) {
    return ''
  }

  const path = await glob(joinPath(extensionPath, patchPath))

  if (path.length > 1) {
    throw new Error('Multiple files found for schema path')
  } else if (path.length === 0) {
    throw new Error('No file found for schema path')
  }

  return readFile(path[0] as string)
}
