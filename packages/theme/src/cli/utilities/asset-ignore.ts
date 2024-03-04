import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import {Checksum, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'

const SHOPIFY_IGNORE = '.shopifyignore'

export async function applyIgnoreFilters(
  themeChecksums: Checksum[],
  themeFileSystem: ThemeFileSystem,
  options: {ignore?: string[]; only?: string[]} = {},
) {
  const shopifyIgnore = await shopifyIgnoredPatterns(themeFileSystem)

  return themeChecksums
    .filter(filterBy(shopifyIgnore, '.shopifyignore'))
    .filter(filterBy(options.ignore, '--ignore'))
    .filter(filterBy(options.only, '--only', true))
}

function filterBy(patterns: string[] | undefined, type: string, invertMatch = false) {
  return ({key}: Checksum) => {
    if (!patterns) return true

    const match = patterns.some((pattern) => key.match(pattern))
    const shouldIgnore = invertMatch ? !match : match

    if (shouldIgnore) {
      outputDebug(`Ignoring theme file ${key} via ${type}...`)
      return false
    }

    return true
  }
}

async function shopifyIgnoredPatterns({root}: ThemeFileSystem) {
  const shopifyIgnorePath = joinPath(root, SHOPIFY_IGNORE)

  const shopifyIgnoreExists = await fileExists(shopifyIgnorePath)
  if (!shopifyIgnoreExists) return []

  const content = await readFile(shopifyIgnorePath, {encoding: 'utf8'})

  return content
    .split(/(\r\n|\r|\n)/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
}
