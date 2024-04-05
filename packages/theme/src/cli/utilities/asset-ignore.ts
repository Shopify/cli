import {fileExists, readFile, matchGlob as originalMatchGlob} from '@shopify/cli-kit/node/fs'
import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'
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

    const match = patterns.some((pattern) => matchGlob(key, pattern) || regexMatch(key, pattern))
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

function matchGlob(key: string, pattern: string) {
  const result = originalMatchGlob(key, pattern)

  if (result) return true

  // When the the standard match fails and the pattern includes '/*.', we
  // replace '/*.' with '/**/*.' to emulate Shopify CLI 2.x behavior, as it was
  // based on 'File.fnmatch'.
  if (pattern.includes('/*.') && !pattern.includes('/**/*.')) {
    const newPatternMatch = originalMatchGlob(key, pattern.replace('/*.', '/**/*.'))
    if (newPatternMatch) {
      outputWarn(
        `Warning: File ${key} does not match the pattern '${pattern}'. To maintain backwards compatibility, we have modified your pattern to ${pattern.replace(
          '/*.',
          '/**/*.',
        )} to explicitly include subdirectories.`,
      )
    }
    return newPatternMatch
  }

  return false
}

function regexMatch(key: string, pattern: string) {
  try {
    return key.match(pattern)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}
