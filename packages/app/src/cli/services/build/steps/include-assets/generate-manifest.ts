import {getNestedValue, tokenizePath} from './copy-config-key-entry.js'
import {joinPath, dirname, extname} from '@shopify/cli-kit/node/path'
import {fileExists, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {outputDebug} from '@shopify/cli-kit/node/output'
import type {BuildContext} from '../../client-steps.js'

interface ConfigKeyManifestEntry {
  anchor?: string | undefined
  groupBy?: string | undefined
  key: string
}

/**
 * Generates a `manifest.json` file in `outputDir` from `configKey` inclusions.
 *
 * Algorithm:
 * 1. Partition entries into anchored (both `anchor` and `groupBy` set) and
 *    root-level (neither set).
 * 2. Return early when there is nothing to write.
 * 3. Build root-level entries.
 * 4. Build grouped entries (anchor/groupBy logic) with path strings resolved
 *    via `resolveManifestPaths` using the copy-tracked `pathMap`.
 * 5. Write `outputDir/manifest.json`, overwriting any existing file.
 *
 * @param pathMap - Map from raw config path values to their output-relative
 *   paths, as recorded during the copy phase by `copyConfigKeyEntry`.
 */
export async function generateManifestFile(
  configKeyEntries: ConfigKeyManifestEntry[],
  context: BuildContext,
  pathMap: Map<string, string | string[]>,
  otherFiles: string[],
): Promise<void> {
  const {extension, options} = context

  type AnchoredEntry = ConfigKeyManifestEntry & {anchor: string; groupBy: string}

  const anchoredIncs: AnchoredEntry[] = []
  const rootIncs: ConfigKeyManifestEntry[] = []

  for (const entry of configKeyEntries) {
    if (typeof entry.anchor === 'string' && typeof entry.groupBy === 'string') {
      anchoredIncs.push(entry as AnchoredEntry)
    } else {
      rootIncs.push(entry)
    }
  }

  if (anchoredIncs.length === 0 && rootIncs.length === 0 && otherFiles.length === 0) return

  const manifest: {[key: string]: unknown} = {}

  // Root-level entries
  for (const inc of rootIncs) {
    const key = lastKeySegment(inc.key)
    const rawValue = getNestedValue(extension.configuration, inc.key)
    if (rawValue === null || rawValue === undefined) continue
    manifest[key] = resolveManifestPaths(rawValue, pathMap)
  }

  // Anchored grouped entries — group by (anchor, groupBy) pair
  const groups = new Map<string, AnchoredEntry[]>()
  for (const inclusion of anchoredIncs) {
    const groupKey = `${inclusion.anchor}||${inclusion.groupBy}`
    const existing = groups.get(groupKey)
    if (existing) {
      existing.push(inclusion)
    } else {
      groups.set(groupKey, [inclusion])
    }
  }

  for (const inclusions of groups.values()) {
    const {anchor, groupBy} = inclusions[0]!
    const anchorValue = getNestedValue(extension.configuration, anchor)
    if (!Array.isArray(anchorValue)) continue

    for (const item of anchorValue) {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) continue
      const typedItem = item as {[key: string]: unknown}

      const manifestKey = typedItem[groupBy]
      if (typeof manifestKey !== 'string') continue

      const partials = inclusions.map((inclusion) => {
        const relPath = stripAnchorPrefix(inclusion.key, anchor)
        const partial = buildRelativeEntry(typedItem, relPath)
        return resolveManifestPaths(partial, pathMap) as {[key: string]: unknown}
      })

      const hasUnresolved = partials.some(containsUnresolvedPath)
      if (hasUnresolved) {
        options.stdout.write(
          `Warning: manifest entry '${manifestKey}' contains unresolved paths — source files may be missing\n`,
        )
      }

      const existing = (manifest[manifestKey] ?? {}) as {[key: string]: unknown}
      manifest[manifestKey] = shallowMerge([existing, ...partials])
    }
  }

  if (otherFiles.length > 0) {
    manifest.files = otherFiles
  }

  if (Object.keys(manifest).length === 0) {
    options.stdout.write('Warning: no manifest entries produced — skipping manifest.json\n')
    return
  }

  await createOrUpdateManifestFile(context, manifest)
}

/**
 * Merges new entries into the manifest.json for an extension.
 * Reads the existing manifest if present and deep merges the new entries.
 * This allows multiple build steps to contribute to the same manifest.
 */
export async function createOrUpdateManifestFile(
  context: BuildContext,
  entries: {[key: string]: unknown},
): Promise<void> {
  const outputPath = context.extension.outputPath
  /**
   * Resolves the output directory from an extension's outputPath.
   * When outputPath is a file (has extension), uses dirname. Otherwise uses outputPath directly.
   */
  const outputDir = extname(outputPath) ? dirname(outputPath) : outputPath

  const manifestPath = joinPath(outputDir, 'manifest.json')

  // Create the output directory
  if (!(await fileExists(outputDir))) {
    await mkdir(outputDir)
  }

  let existing: {[key: string]: unknown} = {}
  if (await fileExists(manifestPath)) {
    try {
      const content = await readFile(manifestPath)
      existing = JSON.parse(content)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      outputDebug(`Warning: could not parse existing manifest.json, starting fresh\n`, context.options.stdout)
    }
  }

  // Deep merge: for each key, if both old and new are objects, merge their fields
  for (const [key, value] of Object.entries(entries)) {
    const existingValue = existing[key]
    if (
      existingValue &&
      typeof existingValue === 'object' &&
      !Array.isArray(existingValue) &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      existing[key] = {...(existingValue as Record<string, unknown>), ...(value as Record<string, unknown>)}
    } else {
      existing[key] = value
    }
  }

  await writeFile(manifestPath, JSON.stringify(existing, null, 2))
  outputDebug(`Updated manifest.json in ${outputDir}\n`, context.options.stdout)
}

/**
 * Strips the anchor prefix (plus trailing dot separator) from a config key path.
 *
 * Examples:
 *   anchor = "extensions[].targeting[]", key = "extensions[].targeting[].tools"
 *     → "tools"
 *   anchor === key → "" (include the whole item)
 *   key does not start with anchor → key returned as-is
 */
function stripAnchorPrefix(key: string, anchor: string): string {
  if (anchor === key) return ''
  const prefix = `${anchor}.`
  if (key.startsWith(prefix)) return key.slice(prefix.length)
  return key
}

/**
 * Builds a partial manifest object from an item and a relative path string.
 *
 * - `""` → returns the item itself
 * - `"tools"` → `{tools: item.tools}`
 * - `"intents[].schema"` → `{intents: item.intents.map(el => buildRelativeEntry(el, "schema"))}`
 */
function buildRelativeEntry(item: {[key: string]: unknown}, relPath: string): {[key: string]: unknown} {
  if (relPath === '') return item

  const tokens = tokenizePath(relPath)
  const [head, ...rest] = tokens
  if (!head) return item
  const restPath = rest.map((t) => `${t.name}${t.flatten ? '[]' : ''}`).join('.')

  const value = item[head.name]

  if (head.flatten) {
    if (!Array.isArray(value)) return {[head.name]: value}
    const mapped = (value as {[key: string]: unknown}[]).map((el) => (restPath ? buildRelativeEntry(el, restPath) : el))
    return {[head.name]: mapped}
  }

  if (restPath && value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
    return {[head.name]: buildRelativeEntry(value as {[key: string]: unknown}, restPath)}
  }

  return {[head.name]: value}
}

/**
 * Merges multiple partial objects into one (shallow / top-level keys).
 */
function shallowMerge(objects: {[key: string]: unknown}[]): {[key: string]: unknown} {
  return Object.assign({}, ...objects)
}

/**
 * Resolves raw config path values to their output-relative paths using the
 * copy-tracked path map. Strings not in the map (and not path-like) are left
 * unchanged. Walks objects and arrays recursively.
 *
 * When a pathMap value is a `string[]` (directory source), the string is
 * replaced with the array — producing a file-list manifest entry.
 */
function resolveManifestPaths(value: unknown, pathMap: Map<string, string | string[]>): unknown {
  if (typeof value === 'string') {
    const looksLikePath = value.startsWith('.') || value.includes('/') || value.includes('\\') || pathMap.has(value)
    return (looksLikePath ? pathMap.get(value) : undefined) ?? value
  }
  if (Array.isArray(value)) return value.map((el) => resolveManifestPaths(el, pathMap))
  if (value !== null && typeof value === 'object') {
    const result: {[key: string]: unknown} = {}
    for (const [key, val] of Object.entries(value as {[key: string]: unknown})) {
      result[key] = resolveManifestPaths(val, pathMap)
    }
    return result
  }
  return value
}

/**
 * Returns the last dot-separated segment of a key path, stripping any `[]` suffix.
 *
 * Examples:
 *   `"tools"` → `"tools"`
 *   `"targeting.tools"` → `"tools"`
 *   `"extensions[].targeting[].tools"` → `"tools"`
 */
function lastKeySegment(key: string): string {
  const last = key.split('.').at(-1) ?? key
  return last.endsWith('[]') ? last.slice(0, -2) : last
}

/**
 * Returns `true` if `value` contains any string — at any depth — that looks
 * like an unresolved config path (starts with `./` or `../`).
 */
function containsUnresolvedPath(value: unknown): boolean {
  if (typeof value === 'string') return value.startsWith('./') || value.startsWith('../')
  if (Array.isArray(value)) return value.some(containsUnresolvedPath)
  if (value !== null && typeof value === 'object') {
    return Object.values(value as {[key: string]: unknown}).some(containsUnresolvedPath)
  }
  return false
}
