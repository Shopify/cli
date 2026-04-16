import {joinPath, basename, relativePath, extname} from '@shopify/cli-kit/node/path'
import {glob, copyFile, copyDirectoryContents, fileExists, mkdir, isDirectory} from '@shopify/cli-kit/node/fs'
import {outputContent, outputDebug, outputToken} from '@shopify/cli-kit/node/output'
import type {BuildContext} from '../../client-steps.js'

/**
 * Handles a `{configKey}` files entry.
 *
 * Resolves the key from the extension's config. String values and string
 * arrays are each used as source paths. Unresolved keys and missing paths are
 * skipped silently with a log message. When `destination` is given, the
 * resolved directory is placed under `outputDir/destination`.
 *
 * File sources are copied with `copyFile` to the output directory.
 * Directory sources use `copyDirectoryContents`.
 *
 * Returns `{filesCopied, pathMap}` where `pathMap` maps each raw config path
 * value to its output-relative location. File sources map to a single string.
 * Directory sources map to a `string[]` of every output-relative file path.
 */
export async function copyConfigKeyEntry(config: {
  key: string
  baseDir: string
  outputDir: string
  context: BuildContext
  destination?: string
  usedBasenames?: Set<string>
}): Promise<{filesCopied: number; pathMap: Map<string, string | string[]>}> {
  const {key, baseDir, outputDir, context, destination, usedBasenames = new Set()} = config
  const {stdout} = context.options
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
    outputDebug(`No value for configKey '${key}', skipping\n`, stdout)
    return {filesCopied: 0, pathMap: new Map()}
  }

  const effectiveOutputDir = destination ? joinPath(outputDir, destination) : outputDir

  // Deduplicate: the same source path shared across multiple targets
  // should only be copied once; the pathMap entry is reused for all references.
  const uniquePaths = [...new Set(paths)]

  // Process sequentially to avoid filesystem race conditions on shared output paths.
  const pathMap = new Map<string, string | string[]>()
  let filesCopied = 0

  /* eslint-disable no-await-in-loop */
  for (const sourcePath of uniquePaths) {
    const fullPath = joinPath(baseDir, sourcePath)
    const exists = await fileExists(fullPath)
    if (!exists) {
      throw new Error(
        outputContent`Couldn't find ${outputToken.path(fullPath)}\n  Please check the path '${sourcePath}' in your configuration`
          .value,
      )
    }

    const sourceIsDir = await isDirectory(fullPath)

    const destDir = effectiveOutputDir

    if (sourceIsDir) {
      // Glob the source directory (not the destination) to get the accurate file list.
      // During dev, the include_assets step runs on every rebuild. If we glob the
      // destination instead, it would pick up files accumulated from previous builds
      // that may no longer exist in the source, inflating the file count and producing
      // stale entries in the manifest's pathMap.
      const sourceFiles = await glob(['**/*'], {cwd: fullPath, absolute: false})
      await copyDirectoryContents(fullPath, destDir)
      stdout.write(`Included '${sourcePath}'\n`)
      const relFiles = sourceFiles.map((file) => relativePath(outputDir, joinPath(destDir, file)))
      pathMap.set(sourcePath, relFiles)
      filesCopied += sourceFiles.length
    } else {
      await mkdir(destDir)
      const filename = basename(fullPath)
      const destFilename = uniqueBasename(filename, usedBasenames)
      usedBasenames.add(destFilename)
      const destPath = joinPath(destDir, destFilename)
      await copyFile(fullPath, destPath)
      const outputRelative = relativePath(outputDir, destPath)
      stdout.write(`Included '${sourcePath}'\n`)
      pathMap.set(sourcePath, outputRelative)
      filesCopied += 1
    }
  }
  /* eslint-enable no-await-in-loop */

  return {filesCopied, pathMap}
}

/**
 * Returns a unique filename given the set of basenames already used in this
 * build. If `filename` hasn't been used, returns it as-is. Otherwise appends
 * a counter: `name-1.ext`, `name-2.ext`, …
 */
function uniqueBasename(filename: string, used: Set<string>): string {
  if (!used.has(filename)) return filename

  const ext = extname(filename)
  const base = ext ? filename.slice(0, -ext.length) : filename
  const maxAttempts = 1000
  let counter = 1
  while (used.has(`${base}-${counter}${ext}`)) {
    counter++
    if (counter > maxAttempts) {
      throw new Error(`Unable to find unique basename for '${filename}' after ${maxAttempts} attempts`)
    }
  }
  return `${base}-${counter}${ext}`
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
