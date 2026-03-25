import {joinPath, basename} from '@shopify/cli-kit/node/path'
import {glob, copyFile, copyDirectoryContents, fileExists, mkdir, isDirectory} from '@shopify/cli-kit/node/fs'
import type {BuildContext} from '../../client-steps.js'

/**
 * Handles a `{configKey}` files entry.
 *
 * Resolves the key from the extension's config. String values and string
 * arrays are each used as source paths. Unresolved keys and missing paths are
 * skipped silently with a log message. When `destination` is given, the
 * resolved directory is placed under `outputDir/destination`.
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
): Promise<number> {
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
    return 0
  }

  const effectiveOutputDir = destination ? joinPath(outputDir, destination) : outputDir

  const counts = await Promise.all(
    paths.map(async (sourcePath) => {
      const fullPath = joinPath(baseDir, sourcePath)
      const exists = await fileExists(fullPath)
      if (!exists) {
        options.stdout.write(`Warning: path '${sourcePath}' does not exist, skipping\n`)
        return 0
      }
      if (!(await isDirectory(fullPath))) {
        const destPath = joinPath(effectiveOutputDir, basename(fullPath))
        await mkdir(effectiveOutputDir)
        await copyFile(fullPath, destPath)
        options.stdout.write(`Included '${sourcePath}'\n`)
        return 1
      }
      await copyDirectoryContents(fullPath, effectiveOutputDir)
      const copied = await glob(['**/*'], {cwd: effectiveOutputDir, absolute: false})
      options.stdout.write(`Included '${sourcePath}'\n`)
      return copied.length
    }),
  )
  return counts.reduce((sum, count) => sum + count, 0)
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
