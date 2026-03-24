import {joinPath, dirname, extname, relativePath, basename} from '@shopify/cli-kit/node/path'
import {glob, copyFile, copyDirectoryContents, fileExists, mkdir, isDirectory} from '@shopify/cli-kit/node/fs'
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
  preserveStructure: z.boolean().default(true),
})

/**
 * ConfigKey inclusion entry — config key resolution.
 *
 * Resolves a path (or array of paths) from the extension configuration and
 * copies the directory contents into the output. Silently skipped when the
 * key is absent. Respects `preserveStructure` and `destination` the same way
 * as the static entry.
 */
const ConfigKeyEntrySchema = z.object({
  type: z.literal('configKey'),
  key: z.string(),
  destination: z.string().optional(),
  preserveStructure: z.boolean().default(false),
})

const InclusionEntrySchema = z.discriminatedUnion('type', [PatternEntrySchema, StaticEntrySchema, ConfigKeyEntrySchema])

/**
 * Configuration schema for include_assets step.
 *
 * `inclusions` is a flat array of entries, each with a `type` discriminant
 * (`'static'`, `'configKey'`, or `'pattern'`). All entries are processed in parallel.
 */
const IncludeAssetsConfigSchema = z.object({
  inclusions: z.array(InclusionEntrySchema),
})

/**
 * Removes any '..' traversal segments from a relative destination path and
 * emits a warning if any were found. Preserves normal '..' that only navigate
 * within the path (e.g. 'foo/../bar' → 'bar') but never allows the result to
 * escape the output root.
 */
function sanitizeDestination(input: string, warn: (msg: string) => void): string {
  const segments = input.replace(/\\/g, '/').split('/')
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
 * - `type: 'static'` — copy a file or directory into the output.
 * - `type: 'configKey'` — resolve a path from the extension's
 *   config and copy into the output; silently skipped if absent.
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

  const counts = await Promise.all(
    config.inclusions.map(async (entry) => {
      const warn = (msg: string) => options.stdout.write(msg)
      const sanitizedDest = entry.destination !== undefined ? sanitizeDestination(entry.destination, warn) : undefined

      if (entry.type === 'pattern') {
        const sourceDir = entry.baseDir ? joinPath(extension.directory, entry.baseDir) : extension.directory
        const destinationDir = sanitizedDest ? joinPath(outputDir, sanitizedDest) : outputDir
        return copyByPattern(
          {
            sourceDir,
            outputDir: destinationDir,
            patterns: entry.include,
            ignore: entry.ignore ?? [],
            preserveStructure: entry.preserveStructure,
          },
          options,
        )
      }

      if (entry.type === 'configKey') {
        return copyConfigKeyEntry(
          {
            key: entry.key,
            baseDir: extension.directory,
            outputDir,
            context,
            preserveStructure: entry.preserveStructure,
            destination: sanitizedDest,
          },
          options,
        )
      }

      if (entry.type === 'static') {
        return copySourceEntry(
          {
            source: entry.source,
            destination: sanitizedDest,
            baseDir: extension.directory,
            outputDir,
            preserveStructure: entry.preserveStructure,
          },
          options,
        )
      }
    }),
  )

  return {filesCopied: counts.reduce((sum, count) => sum + (count ?? 0), 0)}
}

/**
 * Handles a `{source}` or `{source, destination}` files entry.
 *
 * - No `destination`, `preserveStructure` false: copy directory contents into the output root.
 * - No `destination`, `preserveStructure` true: copy the directory under its own name in the output.
 * - With `destination`: copy the file to the explicit destination path (`preserveStructure` is ignored).
 */
async function copySourceEntry(
  config: {
    source: string
    destination: string | undefined
    baseDir: string
    outputDir: string
    preserveStructure: boolean
  },
  options: {stdout: NodeJS.WritableStream},
): Promise<number> {
  const {source, destination, baseDir, outputDir, preserveStructure} = config
  const sourcePath = joinPath(baseDir, source)
  const exists = await fileExists(sourcePath)
  if (!exists) {
    throw new Error(`Source does not exist: ${sourcePath}`)
  }

  if (destination !== undefined) {
    const destPath = joinPath(outputDir, destination)
    if (await isDirectory(sourcePath)) {
      await copyDirectoryContents(sourcePath, destPath)
      const copied = await glob(['**/*'], {cwd: destPath, absolute: false})
      options.stdout.write(`Copied ${source} to ${destination}\n`)
      return copied.length
    }
    await mkdir(dirname(destPath))
    await copyFile(sourcePath, destPath)
    options.stdout.write(`Copied ${source} to ${destination}\n`)
    return 1
  }

  if (!(await isDirectory(sourcePath))) {
    const destPath = joinPath(outputDir, basename(sourcePath))
    await mkdir(outputDir)
    await copyFile(sourcePath, destPath)
    options.stdout.write(`Copied ${source} to ${basename(sourcePath)}\n`)
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
 * Handles a `{configKey}` files entry.
 *
 * Resolves the key from the extension's config. String values and string
 * arrays are each used as source paths. Unresolved keys and missing paths are
 * skipped silently with a log message. When `destination` is given, the
 * resolved directory is placed under `outputDir/destination`.
 */
async function copyConfigKeyEntry(
  config: {
    key: string
    baseDir: string
    outputDir: string
    context: BuildContext
    preserveStructure: boolean
    destination?: string
  },
  options: {stdout: NodeJS.WritableStream},
): Promise<number> {
  const {key, baseDir, outputDir, context, preserveStructure, destination} = config
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
        options.stdout.write(`Copied '${sourcePath}' to ${basename(fullPath)}\n`)
        return 1
      }
      const destDir = preserveStructure ? joinPath(effectiveOutputDir, basename(fullPath)) : effectiveOutputDir
      await copyDirectoryContents(fullPath, destDir)
      const copied = await glob(['**/*'], {cwd: destDir, absolute: false})
      const msg = preserveStructure
        ? `Copied '${sourcePath}' to ${basename(fullPath)}\n`
        : `Copied contents of '${sourcePath}' to output root\n`
      options.stdout.write(msg)
      return copied.length
    }),
  )
  return counts.reduce((sum, count) => sum + count, 0)
}

/**
 * Pattern strategy: glob-based file selection.
 */
async function copyByPattern(
  config: {
    sourceDir: string
    outputDir: string
    patterns: string[]
    ignore: string[]
    preserveStructure: boolean
  },
  options: {stdout: NodeJS.WritableStream},
): Promise<number> {
  const {sourceDir, outputDir, patterns, ignore, preserveStructure} = config
  const files = await glob(patterns, {
    absolute: true,
    cwd: sourceDir,
    ignore,
  })

  if (files.length === 0) {
    options.stdout.write(`Warning: No files matched patterns in ${sourceDir}\n`)
    return 0
  }

  await mkdir(outputDir)

  const duplicates = new Set<string>()
  if (!preserveStructure) {
    const basenames = files.map((fp) => basename(fp))
    const seen = new Set<string>()
    for (const name of basenames) {
      if (seen.has(name)) {
        duplicates.add(name)
      } else {
        seen.add(name)
      }
    }
    if (duplicates.size > 0) {
      const colliding = files.filter((fp) => duplicates.has(basename(fp)))
      options.stdout.write(
        `Warning: filename collision detected when flattening — the following files share a basename and will overwrite each other: ${colliding.join(', ')}\n`,
      )
    }
  }

  // When flattening and collisions exist, deduplicate so last-in-array deterministically wins
  const filesToCopy =
    !preserveStructure && duplicates.size > 0
      ? files.filter((fp, idx) => {
          const name = basename(fp)
          if (!duplicates.has(name)) return true
          const lastIdx = files.reduce((last, file, ii) => (basename(file) === name ? ii : last), -1)
          return lastIdx === idx
        })
      : files

  const copyResults = await Promise.all(
    filesToCopy.map(async (filepath): Promise<number> => {
      const relPath = preserveStructure ? relativePath(sourceDir, filepath) : basename(filepath)
      const destPath = joinPath(outputDir, relPath)

      if (relativePath(outputDir, destPath).startsWith('..')) {
        options.stdout.write(`Warning: skipping '${filepath}' - resolved destination is outside the output directory\n`)
        return 0
      }

      if (filepath === destPath) return 0

      await mkdir(dirname(destPath))
      await copyFile(filepath, destPath)
      return 1
    }),
  )

  const copiedCount = copyResults.reduce((sum, count) => sum + count, 0)
  options.stdout.write(`Copied ${copiedCount} file(s) from ${sourceDir} to ${outputDir}\n`)
  return copiedCount
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
