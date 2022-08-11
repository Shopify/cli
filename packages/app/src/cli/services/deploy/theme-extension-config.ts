import {ThemeExtension} from '../../models/app/extensions.js'
import {file, path} from '@shopify/cli-kit'

export interface ThemeExtensionConfig {
  theme_extension: {
    files: {[key: string]: string}
  }
}

export async function themeExtensionConfig(themeExtension: ThemeExtension): Promise<ThemeExtensionConfig> {
  const files: {[key: string]: string} = {}
  const themeFiles = await path.glob(path.join(themeExtension.directory, '*/*'))
  await Promise.all(
    themeFiles.map(async (filepath) => {
      const relativePath = path.relative(themeExtension.directory, filepath)
      const dirname = path.dirname(relativePath)
      const encoding = dirname === 'assets' ? 'binary' : 'utf8'
      const fileContents = await file.read(filepath, {encoding})
      files[relativePath] = Buffer.from(fileContents, encoding).toString('base64')
    }),
  )
  return {theme_extension: {files}}
}
