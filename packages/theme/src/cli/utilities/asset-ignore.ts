import {uniqBy} from '@shopify/cli-kit/common/array'
import {fileExists, readFile, matchGlob as originalMatchGlob} from '@shopify/cli-kit/node/fs'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderWarning} from '@shopify/cli-kit/node/ui'

const SHOPIFY_IGNORE = '.shopifyignore'
const templatesRegex = /templates\/\*(\.(json|liquid))?$/
const warnedPatterns = new Set<string>()

export function applyIgnoreFilters<T extends {key: string}>(
  files: T[],
  options: {ignoreFromFile?: string[]; ignore?: string[]; only?: string[]} = {},
) {
  const shopifyIgnore = options.ignoreFromFile ?? []
  const ignoreOptions = options.ignore ?? []
  const onlyOptions = options.only ?? []

  const [normalShopifyPatterns = [], negatedShopifyPatterns = []] = filterRegexValues(shopifyIgnore)
  const [normalIgnorePatterns = [], negatedIgnorePatterns = []] = filterRegexValues(ignoreOptions)
  const [normalOnlyPatterns = [], negatedOnlyPatterns = []] = filterRegexValues(onlyOptions)

  let filteredFiles = files.filter(filterBy(normalShopifyPatterns, '.shopifyignore'))
  filteredFiles = filteredFiles.filter(filterBy(normalIgnorePatterns, '--ignore'))
  filteredFiles = filteredFiles.filter(filterBy(normalOnlyPatterns, '--only', true))

  if (negatedShopifyPatterns.length > 0) {
    filteredFiles = filteredFiles.concat(files.filter(filterBy(negatedShopifyPatterns, '.shopifyignore', true)))
  }
  if (negatedIgnorePatterns.length > 0) {
    filteredFiles = filteredFiles.concat(files.filter(filterBy(negatedIgnorePatterns, '--ignore', true)))
  }
  if (negatedOnlyPatterns.length > 0) {
    filteredFiles = filteredFiles.filter(filterBy(negatedOnlyPatterns, '--only'))
  }

  const uniqueFiles = uniqBy(filteredFiles, (file) => file.key)
  return uniqueFiles
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

function filterRegexValues(regexList: string[]) {
  const negatedPatterns = regexList
    .filter((regexList) => regexList.startsWith('!'))
    .map((regexList) => regexList.slice(1))
  const normalPatterns = regexList.filter((regexList) => !regexList.startsWith('!'))

  return [normalPatterns, negatedPatterns]
}

function matchGlob(key: string, pattern: string) {
  const matchOpts = {
    matchBase: true,
    noglobstar: true,
  }

  if (originalMatchGlob(key, pattern, matchOpts)) return true

  if (isRegex(pattern)) return regexMatch(key, asRegex(pattern))

  if (!pattern.includes('*') && pattern.endsWith('/') && !warnedPatterns.has(pattern)) {
    warnedPatterns.add(pattern)
    renderWarning({
      headline: 'Directory pattern may be misleading.',
      body: `For more reliable matching, consider using ${pattern}* or ${pattern}*.filename instead.`,
    })
    return false
  }

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
