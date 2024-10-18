import {fileExists, readFile, matchGlob as originalMatchGlob} from '@shopify/cli-kit/node/fs'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'

const SHOPIFY_IGNORE = '.shopifyignore'
const templatesRegex = /templates\/\*(\.(json|liquid))?$/

export function applyIgnoreFilters<T extends {key: string}>(
  files: T[],
  options: {ignoreFromFile?: string[]; ignore?: string[]; only?: string[]} = {},
) {
  const shopifyIgnore = options.ignoreFromFile ?? []
  const ignoreOptions = options.ignore ?? []
  const onlyOptions = options.only ?? []

  return files
    .filter(filterBy(shopifyIgnore, '.shopifyignore'))
    .filter(filterBy(ignoreOptions, '--ignore'))
    .filter(filterBy(onlyOptions, '--only', true))
}

function filterBy(patterns: string[], type: string, invertMatch = false) {
  return ({key}: {key: string}) => {
    if (patterns.length === 0) return true

    const match = patterns.some(
      (pattern) => matchGlob(key, pattern) || (isRegex(pattern) && regexMatch(key, asRegex(pattern))),
    )
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
  const matchOpts = {
    matchBase: true,
    noglobstar: true,
  }

  const result = originalMatchGlob(key, pattern, matchOpts)

  if (result) return true

  // When the the standard match fails and the pattern includes '/*.', we
  // replace '/*.' with '/**/*.' to emulate Shopify CLI 2.x behavior, as it was
  // based on 'File.fnmatch'.
  if (shouldReplaceGlobPattern(pattern)) {
    return originalMatchGlob(key, pattern.replace(templatesRegex, 'templates/**/*$1'), matchOpts)
  }

  return false
}

function shouldReplaceGlobPattern(pattern: string): boolean {
  return templatesRegex.test(pattern)
}

function regexMatch(key: string, regex: RegExp) {
  return regex.test(key)
}

// https://github.com/Shopify/cli/blob/2ddbd3eee70c50814c5527d6d3eeb7ca601de5f8/packages/cli-kit/assets/cli-ruby/lib/shopify_cli/theme/filter/path_matcher.rb#L17
function isRegex(pattern: string) {
  return pattern.startsWith('/') && pattern.endsWith('/')
}

// https://github.com/Shopify/cli/blob/2ddbd3eee70c50814c5527d6d3eeb7ca601de5f8/packages/cli-kit/assets/cli-ruby/lib/shopify_cli/theme/filter/path_matcher.rb#L21
function asRegex(pattern: string) {
  return new RegExp(pattern.slice(1, -1))
}
