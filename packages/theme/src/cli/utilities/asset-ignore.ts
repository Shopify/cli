import {fileExists, readFile, matchGlob as originalMatchGlob} from '@shopify/cli-kit/node/fs'
import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'

const SHOPIFY_IGNORE = '.shopifyignore'

export function applyIgnoreFilters<T extends {key: string}>(
  files: T[],
  options: {ignoreFromFile?: string[]; ignore?: string[]; only?: string[]} = {},
) {
  const shopifyIgnore = options.ignoreFromFile ?? []
  const ignoreOptions = options.ignore ?? []
  const onlyOptions = options.only ?? []

  raiseWarningForNonExplicitGlobPatterns([...shopifyIgnore, ...ignoreOptions, ...onlyOptions])

  return files
    .filter(filterBy(shopifyIgnore, '.shopifyignore'))
    .filter(filterBy(ignoreOptions, '--ignore'))
    .filter(filterBy(onlyOptions, '--only', true))
}

function filterBy(patterns: string[], type: string, invertMatch = false) {
  return ({key}: {key: string}) => {
    if (patterns.length === 0) return true

    const match = patterns.some((pattern) => matchGlob(key, pattern) || regexMatch(key, pattern))
    const shouldIgnore = invertMatch ? !match : match

    if (shouldIgnore) {
      outputDebug(`Ignoring theme file ${key} via ${type}...`)
      return false
    }

    return true
  }
}

export async function getPatternsFromShopifyIgnore(root: string) {
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
  if (shouldReplaceGlobPattern(pattern)) {
    return originalMatchGlob(key, pattern.replace('/*.', '/**/*.'))
  }

  return false
}

export function raiseWarningForNonExplicitGlobPatterns(patterns: string[]) {
  const allPatterns = new Set(patterns)
  allPatterns.forEach((pattern) => {
    if (shouldReplaceGlobPattern(pattern)) {
      outputWarn(
        `Warning: The pattern '${pattern}' does not include subdirectories. To maintain backwards compatibility, we have modified your pattern to ${pattern.replace(
          '/*.',
          '/**/*.',
        )} to explicitly include subdirectories.`,
      )
    }
  })
}

function shouldReplaceGlobPattern(pattern: string): boolean {
  return pattern.includes('/*.') && !pattern.includes('/**/*.') && pattern.includes('templates/')
}

function regexMatch(key: string, pattern: string) {
  try {
    return key.match(pattern)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}
