import {ThemeExtension} from '../../models/app/extensions.js'
import {readFile} from '@shopify/cli-kit/node/fs'
import {joinPath, relativePath, dirname, glob} from '@shopify/cli-kit/node/path'

export interface ThemeExtensionConfig {
  theme_extension: {
    files: {[key: string]: string}
  }
}

export async function themeExtensionConfig(themeExtension: ThemeExtension): Promise<ThemeExtensionConfig> {
  const files: {[key: string]: string} = {}
  const themeFiles = await glob(joinPath(themeExtension.directory, '*/*'))
  await Promise.all(
    themeFiles.map(async (filepath) => {
      const relativePathName = relativePath(themeExtension.directory, filepath)
      const directoryName = dirname(relativePathName)
      const encoding = directoryName === 'assets' ? 'binary' : 'utf8'
      const fileContents = await readFile(filepath, {encoding})
      files[relativePath] = Buffer.from(fileContents, encoding).toString('base64')
    }),
  )
  return {theme_extension: {files}}
}
