import {joinPath, dirname, extname, relativePath, basename} from '@shopify/cli-kit/node/path'
import {glob, copyFile, copyDirectoryContents, fileExists, mkdir, writeFile} from '@shopify/cli-kit/node/fs'

import {z} from 'zod'
import type {LifecycleStep, BuildContext} from '../client-steps.js'

/**
 * Pattern inclusion entry.
 *
 * Selects files from a source directory using glob patterns. `source` defaults
 * to the extension root when omitted. `include` defaults to `['**\/*']`.
 * `preserveStructure` defaults to `true` (relative paths preserved).
 */
const PatternEntrySchema = z.object({
  type: z.literal('pattern'),
  baseDir: z.string().optional(),
  include: z.array(z.string()).default(['**/*']),
  ignore: z.array(z.string()).optional(),
  destination: z.string().optional(),
  preserveStructure: z.boolean().default(true),
})

/**
 * Static inclusion entry — explicit source path.
 *
 * - With `destination`: copies the file/directory to that exact path.
 * - Without `destination`, `preserveStructure` false (default): merges
 *   directory contents into the output root.
 * - Without `destination`, `preserveStructure` true: places the directory
 *   under its own name in the output.
 */
const StaticEntrySchema = z.object({
  type: z.literal('static'),
  source: z.string(),
  destination: z.string().optional(),
  preserveStructure: z.boolean().default(false),
})

/**
 * ConfigKey inclusion entry — config key resolution.
 *
 * Resolves a path (or array of paths) from the extension configuration and
 * copies the directory contents into the output. Silently skipped when the
 * key is absent. Respects `preserveStructure` and `destination` the same way
 * as the static entry.
 *
 * `anchor` and `groupBy` are optional fields used for manifest generation.
 * When both are present, this entry participates in `generateManifestFile`.
 */
const ConfigKeyEntrySchema = z.object({
  type: z.literal('configKey'),
  key: z.string(),
  destination: z.string().optional(),
  preserveStructure: z.boolean().default(false),
  anchor: z.string().optional(),
  groupBy: z.string().optional(),
})

const InclusionEntrySchema = z.discriminatedUnion('type', [PatternEntrySchema, StaticEntrySchema, ConfigKeyEntrySchema])

/**
 * Configuration schema for include_assets step.
 *
 * `inclusions` is a flat array of entries, each with a `type` discriminant
 * (`'files'` or `'pattern'`). All entries are processed in parallel.
 *
 * When `generateManifest` is `true`, a `manifest.json` file is written to the
 * output directory after all inclusions complete. Only `configKey` entries
 * that have both `anchor` and `groupBy` set participate in manifest generation.
 */
const IncludeAssetsConfigSchema = z.object({
  inclusions: z.array(InclusionEntrySchema),
  generateManifest: z.boolean().default(false),
})

/**
 * Removes any '..' traversal segments from a relative destination path and
 * emits a warning if any were found. Preserves normal '..' that only navigate
 * within the path (e.g. 'foo/../bar' → 'bar') but never allows the result to
 * escape the output root.
 */
function sanitizeDestination(input: string, warn: (msg: string) => void): string {
  const segments = input.split('/')
  const stack: string[] = []
  let stripped = false
  for (const seg of segments) {
    if (seg === '..') {
      stripped = true
      stack.pop()
    } else if (seg !== '.') {
      stack.push(seg)
    }
  }
  const result = stack.join('/')
  if (stripped) {
    warn(`Warning: destination '${input}' contains '..' path traversal - sanitized to '${result || '.'}'\n`)
  }
  return result
}

/**
 * Executes an include_assets build step.
 *
 * Iterates over `config.inclusions` and dispatches each entry by type:
 *
 * - `type: 'files'` with `source` — copy a file or directory into the output.
 * - `type: 'files'` with `configKey` — resolve a path from the extension's
 *   config and copy its directory into the output; silently skipped if absent.
 * - `type: 'pattern'` — glob-based file selection from a source directory
 *   (defaults to extension root when `source` is omitted).
 */
export async function executeIncludeAssetsStep(
  step: LifecycleStep,
  context: BuildContext,
): Promise<{filesCopied: number}> {
  const config = IncludeAssetsConfigSchema.parse(step.config)
  const {extension, options} = context
  // When outputPath is a file (e.g. index.js, index.wasm), the output directory is its
  // parent. When outputPath has no extension, it IS the output directory.
  const outputDir = extname(extension.outputPath) ? dirname(extension.outputPath) : extension.outputPath

  const aggregatedPathMap = new Map<string, string>()

  const counts = await Promise.all(
    config.inclusions.map(async (entry) => {
      const warn = (msg: string) => options.stdout.write(msg)
      const sanitizedDest = entry.destination !== undefined ? sanitizeDestination(entry.destination, warn) : undefined

      if (entry.type === 'pattern') {
        const sourceDir = entry.baseDir ? joinPath(extension.directory, entry.baseDir) : extension.directory
        const destinationDir = sanitizedDest ? joinPath(outputDir, sanitizedDest) : outputDir
        const result = await copyByPattern(
          sourceDir,
          destinationDir,
          entry.include,
          entry.ignore ?? [],
          entry.preserveStructure,
          options,
        )
        return result.filesCopied
      }

      if (entry.type === 'configKey') {
        const result = await copyConfigKeyEntry(
          entry.key,
          extension.directory,
          outputDir,
          context,
          options,
          entry.preserveStructure,
          sanitizedDest,
        )
        result.pathMap.forEach((val, key) => aggregatedPathMap.set(key, val))
        return result.filesCopied
      }

      return copySourceEntry(
        entry.source,
        sanitizedDest,
        extension.directory,
        outputDir,
        options,
        entry.preserveStructure,
      )
    }),
  )

  if (config.generateManifest) {
    await generateManifestFile(config, context, outputDir, aggregatedPathMap)
  }

  return {filesCopied: counts.reduce((sum, count) => sum + count, 0)}
}

/**
 * Handles a `{source}` or `{source, destination}` files entry.
 *
 * - No `destination`, `preserveStructure` false: copy directory contents into the output root.
 * - No `destination`, `preserveStructure` true: copy the directory under its own name in the output.
 * - With `destination`: copy the file to the explicit destination path (`preserveStructure` is ignored).
 */
async function copySourceEntry(
  source: string,
  destination: string | undefined,
  baseDir: string,
  outputDir: string,
  options: {stdout: NodeJS.WritableStream},
  preserveStructure: boolean,
): Promise<number> {
  const sourcePath = joinPath(baseDir, source)
  const exists = await fileExists(sourcePath)
  if (!exists) {
    throw new Error(`Source does not exist: ${sourcePath}`)
  }

  if (destination !== undefined) {
    const destPath = joinPath(outputDir, destination)
    await mkdir(dirname(destPath))
    await copyFile(sourcePath, destPath)
    options.stdout.write(`Copied ${source} to ${destination}\n`)
    return 1
  }

  const destDir = preserveStructure ? joinPath(outputDir, basename(sourcePath)) : outputDir
  await copyDirectoryContents(sourcePath, destDir)
  const copied = await glob(['**/*'], {cwd: destDir, absolute: false})
  const msg = preserveStructure
    ? `Copied ${source} to ${basename(sourcePath)}\n`
    : `Copied contents of ${source} to output root\n`
  options.stdout.write(msg)
  return copied.length
}

/**
 * Returns a destination path for `filename` inside `dir` that does not already
 * exist. If `dir/filename` is free, returns it as-is. Otherwise appends a
 * counter before the extension: `name-1.ext`, `name-2.ext`, …
 */
async function findUniqueDestPath(dir: string, filename: string): Promise<string> {
  const candidate = joinPath(dir, filename)
  if (!(await fileExists(candidate))) return candidate

  const ext = extname(filename)
  const base = ext ? filename.slice(0, -ext.length) : filename
  let counter = 1
  // Sequential loop is intentional: each iteration must check the previous
  // result before proceeding to avoid race conditions on concurrent copies.

  while (true) {
    const next = joinPath(dir, `${base}-${counter}${ext}`)
    // eslint-disable-next-line no-await-in-loop
    if (!(await fileExists(next))) return next
    counter++
  }
}

/**
 * Handles a `{configKey}` files entry.
 *
 * Resolves the key from the extension's config. String values and string
 * arrays are each used as source paths. Unresolved keys and missing paths are
 * skipped silently with a log message. When `destination` is given, the
 * resolved directory is placed under `outputDir/destination`.
 *
 * File sources are copied with `copyFile` using a unique destination name
 * (via `findUniqueDestPath`) to prevent overwrites when multiple config values
 * resolve to files with the same basename. Directory sources use
 * `copyDirectoryContents` (existing behavior).
 *
 * Returns `{filesCopied, pathMap}` where `pathMap` maps each raw config path
 * value (e.g. `"./tools.json"`) to its actual output-relative path (e.g.
 * `"subdir/tools.json"` or `"subdir/tools-1.json"` if renamed to avoid a
 * collision). Only successfully copied paths appear in the map.
 */
async function copyConfigKeyEntry(
  key: string,
  baseDir: string,
  outputDir: string,
  context: BuildContext,
  options: {stdout: NodeJS.WritableStream},
  preserveStructure: boolean,
  destination?: string,
): Promise<{filesCopied: number; pathMap: Map<string, string>}> {
  const value = getNestedValue(context.extension.configuration, key)
  let paths: string[]
  if (typeof value === 'string') {
    paths = [value]
  } else if (Array.isArray(value)) {
    paths = value.filter((item): item is string => typeof item === 'string')
  } else {
    paths = []
  }

  if (paths.length === 0) {
    options.stdout.write(`No value for configKey '${key}', skipping\n`)
    return {filesCopied: 0, pathMap: new Map()}
  }

  const effectiveOutputDir = destination ? joinPath(outputDir, destination) : outputDir

  // Deduplicate: the same source path (e.g. shared tools.json across targets)
  // should only be copied once. The pathMap entry is reused for all references.
  const uniquePaths = [...new Set(paths)]

  // Process sequentially — findUniqueDestPath relies on filesystem state that
  // would race if multiple copies ran in parallel against the same output dir.
  const pathMap = new Map<string, string>()
  let filesCopied = 0

  /* eslint-disable no-await-in-loop */
  for (const sourcePath of uniquePaths) {
    const fullPath = joinPath(baseDir, sourcePath)
    const exists = await fileExists(fullPath)
    if (!exists) {
      options.stdout.write(`Warning: path '${sourcePath}' does not exist, skipping\n`)
      continue
    }

    const destDir = preserveStructure ? joinPath(effectiveOutputDir, basename(fullPath)) : effectiveOutputDir

    // Heuristic: a path with a file extension is treated as a file; without one
    // it is treated as a directory. This covers the common cases (e.g.
    // `./tools.json` is a file, `public` is a directory) without a stat() call.
    const isFile = extname(basename(fullPath)) !== ''

    if (isFile) {
      await mkdir(destDir)
      const uniqueDestPath = await findUniqueDestPath(destDir, basename(fullPath))
      await copyFile(fullPath, uniqueDestPath)
      const outputRelative = relativePath(outputDir, uniqueDestPath)
      options.stdout.write(`Copied '${sourcePath}' to ${outputRelative}\n`)
      pathMap.set(sourcePath, outputRelative)
      filesCopied += 1
    } else {
      await copyDirectoryContents(fullPath, destDir)
      const copied = await glob(['**/*'], {cwd: destDir, absolute: false})
      const msg = preserveStructure
        ? `Copied '${sourcePath}' to ${basename(fullPath)}\n`
        : `Copied contents of '${sourcePath}' to output root\n`
      options.stdout.write(msg)
      pathMap.set(sourcePath, relativePath(outputDir, destDir))
      filesCopied += copied.length
    }
  }
  /* eslint-enable no-await-in-loop */

  return {filesCopied, pathMap}
}

/**
 * Pattern strategy: glob-based file selection.
 */
async function copyByPattern(
  sourceDir: string,
  outputDir: string,
  patterns: string[],
  ignore: string[],
  preserveStructure: boolean,
  options: {stdout: NodeJS.WritableStream},
): Promise<{filesCopied: number}> {
  const files = await glob(patterns, {
    absolute: true,
    cwd: sourceDir,
    ignore,
  })

  if (files.length === 0) {
    options.stdout.write(`Warning: No files matched patterns in ${sourceDir}\n`)
    return {filesCopied: 0}
  }

  await mkdir(outputDir)

  await Promise.all(
    files.map(async (filepath) => {
      const relPath = preserveStructure ? relativePath(sourceDir, filepath) : basename(filepath)
      const destPath = joinPath(outputDir, relPath)

      if (relativePath(outputDir, destPath).startsWith('..')) {
        options.stdout.write(`Warning: skipping '${filepath}' - resolved destination is outside the output directory\n`)
        return
      }

      if (filepath === destPath) return

      await mkdir(dirname(destPath))
      await copyFile(filepath, destPath)
    }),
  )

  options.stdout.write(`Copied ${files.length} file(s) from ${sourceDir} to ${outputDir}\n`)
  return {filesCopied: files.length}
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
 *
 * Uses `tokenizePath` to walk one token at a time recursively.
 */
function buildRelativeEntry(item: {[key: string]: unknown}, relPath: string): {[key: string]: unknown} {
  if (relPath === '') return item

  const tokens = tokenizePath(relPath)
  const [head, ...rest] = tokens
  if (!head) return item
  const restPath = rest.map((t) => `${t.name}${t.flatten ? '[]' : ''}`).join('.')

  const value = item[head.name]

  if (head.flatten) {
    // Array segment: map over each element with the remaining path
    if (!Array.isArray(value)) return {[head.name]: value}
    const mapped = (value as {[key: string]: unknown}[]).map((el) => (restPath ? buildRelativeEntry(el, restPath) : el))
    return {[head.name]: mapped}
  }

  // Plain segment — recurse if there are more tokens
  if (restPath && value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
    return {[head.name]: buildRelativeEntry(value as {[key: string]: unknown}, restPath)}
  }

  return {[head.name]: value}
}

/**
 * Merges multiple partial objects into one (shallow / top-level keys).
 *
 * Top-level keys are guaranteed not to conflict across inclusions in the same
 * anchor group, so a simple `Object.assign` is sufficient.
 */
function deepMerge(objects: {[key: string]: unknown}[]): {[key: string]: unknown} {
  return Object.assign({}, ...objects)
}

/**
 * Resolves raw config path values to their output-relative paths using the
 * copy-tracked path map. Strings found in the map are replaced with their
 * output-relative path; strings not in the map (URLs, type strings, etc.)
 * are left unchanged. Walks objects and arrays recursively.
 */
function resolveManifestPaths(value: unknown, pathMap: Map<string, string>): unknown {
  if (typeof value === 'string') return pathMap.get(value) ?? value
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
 * Generates a `manifest.json` file in `outputDir` from `configKey` inclusions.
 *
 * Algorithm:
 * 1. Partition all `configKey` inclusions into three categories:
 *    - `partialAnchor`: exactly one of `anchor` / `groupBy` is set → warn and
 *      treat as root-level (no grouping).
 *    - `anchoredIncs`: both `anchor` and `groupBy` are set → grouped entries.
 *    - `rootIncs`: neither `anchor` nor `groupBy` (plus any partialAnchor ones
 *      after the warning) → root-level fields.
 * 2. Return early when there is nothing to write.
 * 3. Build root-level entries from `rootIncs`.
 * 4. Build grouped entries from `anchoredIncs` (existing anchor/groupBy logic),
 *    with all leaf path strings resolved via `resolveManifestPaths` using the
 *    copy-tracked `pathMap`.
 * 5. Write the resulting object to `outputDir/manifest.json`.
 *
 * @param pathMap - Map from raw config path values to their output-relative
 *   paths, as recorded during the copy phase by `copyConfigKeyEntry`.
 */
async function generateManifestFile(
  config: z.infer<typeof IncludeAssetsConfigSchema>,
  context: BuildContext,
  outputDir: string,
  pathMap: Map<string, string>,
): Promise<void> {
  const {extension, options} = context

  // Step 1: partition configKey inclusions
  type ConfigKeyEntry = z.infer<typeof ConfigKeyEntrySchema>
  const configKeyInclusions = config.inclusions.filter((entry): entry is ConfigKeyEntry => entry.type === 'configKey')

  type AnchoredEntry = ConfigKeyEntry & {anchor: string; groupBy: string}

  const partialAnchor: ConfigKeyEntry[] = []
  const anchoredIncs: AnchoredEntry[] = []
  const rootIncs: ConfigKeyEntry[] = []

  for (const entry of configKeyInclusions) {
    const hasAnchor = typeof entry.anchor === 'string'
    const hasGroupBy = typeof entry.groupBy === 'string'

    if (hasAnchor && hasGroupBy) {
      anchoredIncs.push(entry as AnchoredEntry)
    } else if (hasAnchor !== hasGroupBy) {
      // Exactly one of the pair is set — warn and demote to root
      options.stdout.write(
        `Warning: configKey inclusion with key "${entry.key}" has anchor without groupBy (or vice versa) — skipping manifest grouping\n`,
      )
      partialAnchor.push(entry)
    } else {
      rootIncs.push(entry)
    }
  }

  // Partial-anchor entries are treated as root-level after the warning
  const allRootIncs = [...rootIncs, ...partialAnchor]

  if (anchoredIncs.length === 0 && allRootIncs.length === 0) return

  // Step 2: build manifest
  const manifest: {[key: string]: unknown} = {}

  // Step 3: root-level entries
  for (const inc of allRootIncs) {
    const key = lastKeySegment(inc.key)
    const rawValue = getNestedValue(extension.configuration, inc.key)
    if (rawValue === null || rawValue === undefined) continue
    manifest[key] = resolveManifestPaths(rawValue, pathMap)
  }

  // Step 4: anchored grouped entries — group by (anchor, groupBy) pair
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

    // Resolve the anchor array from configuration
    const anchorValue = getNestedValue(extension.configuration, anchor)
    if (!Array.isArray(anchorValue)) continue

    for (const item of anchorValue) {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) continue
      const typedItem = item as {[key: string]: unknown}

      const manifestKey = typedItem[groupBy]
      if (typeof manifestKey !== 'string') continue

      // Build, path-resolve, and merge partial objects for all inclusions in this group
      const partials = inclusions.map((inclusion) => {
        const relPath = stripAnchorPrefix(inclusion.key, anchor)
        const partial = buildRelativeEntry(typedItem, relPath)
        return resolveManifestPaths(partial, pathMap) as {[key: string]: unknown}
      })

      manifest[manifestKey] = deepMerge(partials)
    }
  }

  // Step 5: write manifest.json
  const manifestPath = joinPath(outputDir, 'manifest.json')
  await mkdir(outputDir)
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
  options.stdout.write(`Generated manifest.json in ${outputDir}\n`)
}

/**
 * Splits a path into tokens. A token with `flatten: true` (the `[]` suffix)
 * signals that an array is expected at that position and the result should be
 * flattened one level before continuing. Plain tokens preserve whatever shape
 * is already in flight — if the current value is already an array (from a
 * prior flatten), the field is plucked from each element automatically.
 *
 * Examples:
 *   "tools"                              → [name:"tools", flatten:false]
 *   "targeting.tools"                    → [name:"targeting",...], [name:"tools",...]
 *   "extensions[].targeting[].schema"   → [name:"extensions", flatten:true], ...
 */
function tokenizePath(path: string): {name: string; flatten: boolean}[] {
  return path.split('.').map((part) => {
    const flatten = part.endsWith('[]')
    return {name: flatten ? part.slice(0, -2) : part, flatten}
  })
}

/**
 * Resolves a dot-separated path (with optional `[]` flatten markers) from a
 * config object.
 *
 * - Plain segments (`targeting.tools`): dot-notation access; when the current
 *   value is already an array (due to a prior flatten), the field is plucked
 *   from every element automatically.
 * - Flatten segments (`extensions[]`): access the field and flatten one level
 *   of nesting. Returns `undefined` if the value at that point is not an array
 *   — the `[]` suffix is a contract that an array is expected there.
 */
function getNestedValue(obj: {[key: string]: unknown}, path: string): unknown {
  let current: unknown = obj

  for (const {name, flatten} of tokenizePath(path)) {
    if (current === null || current === undefined) return undefined

    if (Array.isArray(current)) {
      const plucked = current
        .map((item) =>
          item !== null && typeof item === 'object' ? (item as {[key: string]: unknown})[name] : undefined,
        )
        .filter((val): val is NonNullable<unknown> => val !== undefined)
      current = plucked.length > 0 ? plucked : undefined
    } else if (typeof current === 'object') {
      current = (current as {[key: string]: unknown})[name]
    } else {
      return undefined
    }

    if (flatten) {
      if (!Array.isArray(current)) return undefined
      current = (current as unknown[]).flat(1)
    }
  }

  return current
}
