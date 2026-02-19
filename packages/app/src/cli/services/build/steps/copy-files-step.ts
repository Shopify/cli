import {resolveConfigurableValue} from '../build-steps.js'
import {joinPath, dirname, extname, relativePath, basename} from '@shopify/cli-kit/node/path'
import {glob, copyFile, copyDirectoryContents, fileExists, mkdir} from '@shopify/cli-kit/node/fs'
import {z} from 'zod'
import type {BuildStep, BuildContext} from '../build-steps.js'

/**
 * Zod schema for a configurable value (literal or reference).
 * Accepts either a literal value of type T, or a config/env reference object.
 */
const configurableValueSchema = <T extends z.ZodTypeAny>(literalSchema: T) =>
  z.union([literalSchema, z.object({configPath: z.string()}), z.object({envVar: z.string()})])

/**
 * Files strategy definition.
 *
 * Each entry in `files` is one of:
 * - `{source}` only: copy the directory's contents into the output root.
 * - `{source, destination}`: copy the file to an explicit destination path.
 * - `{tomlKey}`: resolve a path from the extension's TOML config and copy its
 *   directory contents into the output root. Silently skipped when the key is absent.
 */
const FilesDefinitionSchema = z.object({
  files: z.array(
    z.union([z.object({source: z.string(), destination: z.string().optional()}), z.object({tomlKey: z.string()})]),
  ),
})

/**
 * Pattern strategy definition.
 *
 * Selects files from a single source directory using glob patterns.
 */
const PatternDefinitionSchema = z.object({
  source: z.string().optional(),
  patterns: configurableValueSchema(z.array(z.string())).optional(),
  ignore: configurableValueSchema(z.array(z.string())).optional(),
  destination: z.string().optional(),
  preserveStructure: z.boolean().default(true),
})

/**
 * Configuration schema for copy_files step.
 * Discriminated by strategy; definition shape is tied to the chosen strategy.
 */
const CopyFilesConfigSchema = z.discriminatedUnion('strategy', [
  z.object({
    strategy: z.literal('files'),
    definition: FilesDefinitionSchema,
  }),
  z.object({
    strategy: z.literal('pattern'),
    definition: PatternDefinitionSchema,
  }),
])

/**
 * Executes a copy_files build step.
 *
 * Supports two strategies:
 *
 * 1. **'files' strategy**: each entry in `definition.files` is either:
 *    - `{source}` — copy directory contents into the output root.
 *    - `{source, destination}` — copy a file to an explicit destination path.
 *    - `{tomlKey}` — resolve a path from the extension's TOML config and copy
 *      its directory contents into the output root; silently skipped if absent.
 *
 * 2. **'pattern' strategy**: glob-based file selection from a single source directory.
 */
export async function executeCopyFilesStep(step: BuildStep, context: BuildContext): Promise<{filesCopied: number}> {
  const config = CopyFilesConfigSchema.parse(step.config)
  const {extension, options} = context
  // When outputPath is a file (e.g. index.js, index.wasm), the output directory is its
  // parent. When outputPath has no extension, it IS the output directory (copy_files mode
  // extensions where outputPath points to a bundle directory, not a single file).
  const outputDir = extname(extension.outputPath) ? dirname(extension.outputPath) : extension.outputPath

  switch (config.strategy) {
    case 'files': {
      return copyFilesList(config.definition.files, extension.directory, outputDir, context, options)
    }
    case 'pattern': {
      const {definition} = config

      if (!definition.source) {
        throw new Error(`Build step "${step.displayName}" requires a source`)
      }

      const sourceDir = joinPath(extension.directory, definition.source)
      const resolvedPatterns = resolveConfigurableValue(definition.patterns, context) ?? ['**/*']
      const resolvedIgnore = resolveConfigurableValue(definition.ignore, context) ?? []
      const destinationDir = definition.destination ? joinPath(outputDir, definition.destination) : outputDir

      return copyByPattern(
        sourceDir,
        destinationDir,
        resolvedPatterns,
        resolvedIgnore,
        definition.preserveStructure,
        options,
      )
    }
  }
}

/**
 * Files strategy — processes a mixed list of `source` and `tomlKey` entries.
 */
async function copyFilesList(
  files: ({source: string; destination?: string} | {tomlKey: string})[],
  baseDir: string,
  outputDir: string,
  context: BuildContext,
  options: {stdout: NodeJS.WritableStream},
): Promise<{filesCopied: number}> {
  const counts = await Promise.all(
    files.map(async (entry) => {
      if ('tomlKey' in entry) {
        return copyTomlKeyEntry(entry.tomlKey, baseDir, outputDir, context, options)
      }
      return copySourceEntry(entry.source, entry.destination, baseDir, outputDir, options)
    }),
  )
  return {filesCopied: counts.reduce((sum, count) => sum + count, 0)}
}

/**
 * Handles a `{source}` or `{source, destination}` files entry.
 *
 * - No `destination`: copy directory contents into the output root.
 * - With `destination`: copy the file to the explicit destination path.
 */
async function copySourceEntry(
  source: string,
  destination: string | undefined,
  baseDir: string,
  outputDir: string,
  options: {stdout: NodeJS.WritableStream},
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

  await copyDirectoryContents(sourcePath, outputDir)
  const copied = await glob(['**/*'], {cwd: outputDir, absolute: false})
  options.stdout.write(`Copied contents of ${source} to output root\n`)
  return copied.length
}

/**
 * Handles a `{tomlKey}` files entry.
 *
 * Resolves the key from the extension's TOML config. String values and string
 * arrays are each used as source paths. Unresolved keys and missing paths are
 * skipped silently with a log message.
 */
async function copyTomlKeyEntry(
  key: string,
  baseDir: string,
  outputDir: string,
  context: BuildContext,
  options: {stdout: NodeJS.WritableStream},
): Promise<number> {
  const value = resolveConfigurableValue({configPath: key}, context)
  let paths: string[]
  if (typeof value === 'string') {
    paths = [value]
  } else if (Array.isArray(value)) {
    paths = value.filter((item): item is string => typeof item === 'string')
  } else {
    paths = []
  }

  if (paths.length === 0) {
    options.stdout.write(`No value for tomlKey '${key}', skipping\n`)
    return 0
  }

  const counts = await Promise.all(
    paths.map(async (sourcePath) => {
      const fullPath = joinPath(baseDir, sourcePath)
      const exists = await fileExists(fullPath)
      if (!exists) {
        options.stdout.write(`Warning: path '${sourcePath}' does not exist, skipping\n`)
        return 0
      }
      await copyDirectoryContents(fullPath, outputDir)
      const copied = await glob(['**/*'], {cwd: outputDir, absolute: false})
      options.stdout.write(`Copied contents of '${sourcePath}' to output root\n`)
      return copied.length
    }),
  )
  return counts.reduce((sum, count) => sum + count, 0)
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

      if (filepath === destPath) return

      await mkdir(dirname(destPath))
      await copyFile(filepath, destPath)
    }),
  )

  options.stdout.write(`Copied ${files.length} file(s) from ${sourceDir} to ${outputDir}\n`)
  return {filesCopied: files.length}
}
