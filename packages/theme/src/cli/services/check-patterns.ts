import {listMatchedFiles} from '../utilities/asset-ignore.js'
import {mountThemeFileSystem} from '../utilities/theme-fs.js'
import {Checksum, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'

export async function checkPatterns(path: string, patterns: string[]): Promise<{[key: string]: string[]}> {
  const themeFileSystem: ThemeFileSystem = await mountThemeFileSystem(path)
  const files: Checksum[] = Array.from(themeFileSystem.files.values())

  const matches: {[key: string]: string[]} = {}
  patterns.forEach((pattern) => {
    const matchedFiles = listMatchedFiles(files, pattern)
    matches[pattern] = matchedFiles
  })

  return matches
}
