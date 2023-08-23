import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {themeExtensionFiles} from '../../utilities/extensions/theme.js'
import {readFile} from '@shopify/cli-kit/node/fs'
import {joinPath, relativePath, dirname} from '@shopify/cli-kit/node/path'

export interface ThemeExtensionConfig {
  theme_extension: {
    files: {[key: string]: string}
  }
}

export async function themeExtensionConfig(themeExtension: ExtensionInstance): Promise<ThemeExtensionConfig> {
  const files: {[key: string]: string} = {}
  const themeFiles = await themeExtensionFiles(themeExtension)
  let themeExtensionDirectory = themeExtension.directory
  if (themeExtension.configuration.build_directory) {
    themeExtensionDirectory = joinPath(themeExtension.directory, themeExtension.configuration.build_directory)
  }
  await Promise.all(
    themeFiles.map(async (filepath) => {
      const relativePathName = relativePath(themeExtensionDirectory, filepath)
      const directoryName = dirname(relativePathName)
      const encoding = directoryName === 'assets' ? 'binary' : 'utf8'
      const fileContents = await readFile(filepath, {encoding})
      files[relativePathName] = Buffer.from(fileContents, encoding).toString('base64')
    }),
  )
  return {theme_extension: {files}}
}
