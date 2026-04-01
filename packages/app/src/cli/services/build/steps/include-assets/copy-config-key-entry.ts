import {joinPath, basename, relativePath, extname} from '@shopify/cli-kit/node/path'
import {glob, copyFile, copyDirectoryContents, fileExists, mkdir, isDirectory} from '@shopify/cli-kit/node/fs'
import type {BuildContext} from '../../client-steps.js'

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
 * `copyDirectoryContents`.
 *
 * Returns `{filesCopied, pathMap}` where `pathMap` maps each raw config path
 * value to its output-relative location. File sources map to a single string.
 * Directory sources map to a `string[]` of every output-relative file path.
 */
export async function copyConfigKeyEntry(
  config: {
    key: string
    baseDir: string
    outputDir: string
    context: BuildContext
    destination?: string
  },
  options: {stdout: NodeJS.WritableStream},
): Promise<{filesCopied: number; pathMap: Map<string, string | string[]>}> {
  const {key, baseDir, outputDir, context, destination} = config
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

  // Deduplicate: the same source path shared across multiple targets
  // should only be copied once; the pathMap entry is reused for all references.
  const uniquePaths = [...new Set(paths)]

  // Process sequentially — findUniqueDestPath relies on filesystem state that
  // would race if multiple copies ran in parallel against the same output dir.
  const pathMap = new Map<string, string | string[]>()
  let filesCopied = 0

  /* eslint-disable no-await-in-loop */
  for (const sourcePath of uniquePaths) {
    const fullPath = joinPath(baseDir, sourcePath)
    const exists = await fileExists(fullPath)
    if (!exists) {
      options.stdout.write(`Warning: path '${sourcePath}' does not exist, skipping\n`)
      continue
    }

    const sourceIsDir = await isDirectory(fullPath)

    const destDir = effectiveOutputDir

    if (sourceIsDir) {
      await copyDirectoryContents(fullPath, destDir)
      const copied = await glob(['**/*'], {cwd: destDir, absolute: false})
      options.stdout.write(`Included '${sourcePath}'\n`)
      const relFiles = copied.map((file) => relativePath(outputDir, joinPath(destDir, file)))
      pathMap.set(sourcePath, relFiles)
      filesCopied += copied.length
    } else {
      await mkdir(destDir)
      const uniqueDestPath = await findUniqueDestPath(destDir, basename(fullPath))
      await copyFile(fullPath, uniqueDestPath)
      const outputRelative = relativePath(outputDir, uniqueDestPath)
      options.stdout.write(`Included '${sourcePath}'\n`)
      pathMap.set(sourcePath, outputRelative)
      filesCopied += 1
    }
  }
  /* eslint-enable no-await-in-loop */

  return {filesCopied, pathMap}
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
  const maxAttempts = 1000
  while (counter <= maxAttempts) {
    const next = joinPath(dir, `${base}-${counter}${ext}`)
    // eslint-disable-next-line no-await-in-loop
    if (!(await fileExists(next))) return next
    counter++
  }
  throw new Error(`Unable to find unique destination path for '${filename}' in '${dir}' after ${maxAttempts} attempts`)
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
export function tokenizePath(path: string): {name: string; flatten: boolean}[] {
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
export function getNestedValue(obj: {[key: string]: unknown}, path: string): unknown {
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
