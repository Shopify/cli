import {getNestedValue} from './utils.js'
import {joinPath, dirname, extname, relativePath, basename} from '@shopify/cli-kit/node/path'
import {glob, copyFile, copyDirectoryContents, fileExists, mkdir} from '@shopify/cli-kit/node/fs'
import {z} from 'zod'
import type {ClientStep, BuildContext} from '../client-steps.js'
import type {BuildManifestStepOutput, ResolvedAsset, ResolvedAssets} from './build-manifest-step.js'

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
 */
const ConfigKeyEntrySchema = z.object({
  type: z.literal('configKey'),
  key: z.string(),
  destination: z.string().optional(),
  preserveStructure: z.boolean().default(false),
})

/**
 * manifest_result strategy definition.
 *
 * Reads a `BuildManifestStepOutput` from a previous step's result in the build context
 * and copies all assets flagged `static: true` to the output directory.
 * Each static asset's `module` field is the source path (relative to the extension
 * directory) and its `filepath` field is the destination (relative to the output dir).
 */
const ManifestResultDefinitionSchema = z.object({
  /**
   * The `id` of the step whose manifest result to consume.
   * Defaults to `'build-manifest'`.
   */
  type: z.literal('manifest_result'),
  stepId: z.string().default('build-manifest'),
})

const InclusionEntrySchema = z.discriminatedUnion('type', [
  PatternEntrySchema,
  StaticEntrySchema,
  ConfigKeyEntrySchema,
  ManifestResultDefinitionSchema,
])

/**
 * Configuration schema for include_assets step.
 *
 * `inclusions` is a flat array of entries, each with a `type` discriminant
 * (`'files'` or `'pattern'`). All entries are processed in parallel.
 */
const IncludeAssetsConfigSchema = z.object({
  inclusions: z.array(InclusionEntrySchema),
})

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
  step: ClientStep,
  context: BuildContext,
): Promise<{filesCopied: number}> {
  const config = IncludeAssetsConfigSchema.parse(step.config)
  const {extension, options} = context
  // When outputPath is a file (e.g. index.js, index.wasm), the output directory is its
  // parent. When outputPath has no extension, it IS the output directory.
  const outputDir = extname(extension.outputPath) ? dirname(extension.outputPath) : extension.outputPath

  const counts = await Promise.all(
    config.inclusions.map(async (entry) => {
      if (entry.type === 'pattern') {
        const sourceDir = entry.baseDir ? joinPath(extension.directory, entry.baseDir) : extension.directory
        const destinationDir = entry.destination ? joinPath(outputDir, entry.destination) : outputDir
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
        return copyConfigKeyEntry(
          entry.key,
          extension.directory,
          outputDir,
          context,
          options,
          entry.preserveStructure,
          entry.destination,
        )
      }

      if (entry.type === 'manifest_result') {
        return copyStaticAssetsFromManifest(entry.stepId, outputDir, context)
      }

      return copySourceEntry(
        entry.source,
        entry.destination,
        extension.directory,
        outputDir,
        options,
        entry.preserveStructure,
      )
    }),
  )

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
 * Handles a `{configKey}` files entry.
 *
 * Resolves the key from the extension's config. String values and string
 * arrays are each used as source paths. Unresolved keys and missing paths are
 * skipped silently with a log message. When `destination` is given, the
 * resolved directory is placed under `outputDir/destination`.
 */
async function copyConfigKeyEntry(
  key: string,
  baseDir: string,
  outputDir: string,
  context: BuildContext,
  options: {stdout: NodeJS.WritableStream},
  preserveStructure: boolean,
  destination?: string,
): Promise<number> {
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

/**
 * manifest_result strategy — copies all static assets from a previous step's manifest result.
 *
 * Reads the named step's output from `context.stepResults`, collects every asset
 * with `static: true`, then copies each one from its `module` path (relative to the
 * extension directory) to its `filepath` path (relative to the output directory).
 *
 * Assets without a `module` field are skipped — they are considered already in place.
 * Both single-mode (`{assets}`) and forEach-mode (`{manifests}`) outputs are supported.
 */
async function copyStaticAssetsFromManifest(stepId: string, outputDir: string, context: BuildContext): Promise<number> {
  const stepResult = context.stepResults.get(stepId)

  if (!stepResult) {
    throw new Error(`Step '${stepId}' not found in step results. Ensure the build_manifest step runs before this step.`)
  }

  if (!stepResult.success) {
    throw new Error(`Step '${stepId}' didn't succeed — can't copy static assets from its manifest.`)
  }

  const output = stepResult.output as BuildManifestStepOutput
  const staticAssets = collectStaticAssets(output)

  if (staticAssets.length === 0) {
    context.options.stdout.write('No static assets found in build manifest\n')
    return 0
  }

  await Promise.all(
    staticAssets.map(async (asset) => {
      // Assets without a module path are not file-copy candidates
      if (!asset.module) return
      const sourcePath = joinPath(context.extension.directory, asset.module)
      const destPath = joinPath(outputDir, asset.filepath)
      await mkdir(dirname(destPath))
      await copyFile(sourcePath, destPath)
    }),
  )

  context.options.stdout.write(`Copied ${staticAssets.length} static asset(s) from build manifest\n`)
  return staticAssets.length
}

/**
 * Collects all assets with `static: true` from a BuildManifestStepOutput.
 * Flattens both single-mode and forEach-mode output shapes.
 */
function collectStaticAssets(output: BuildManifestStepOutput): ResolvedAsset[] {
  const allAssets: ResolvedAssets =
    'assets' in output
      ? output.assets
      : output.manifests.reduce<ResolvedAssets>((acc, manifest) => ({...acc, ...manifest.build_manifest.assets}), {})

  const result: ResolvedAsset[] = []
  for (const value of Object.values(allAssets)) {
    if (Array.isArray(value)) {
      result.push(...value.filter((asset) => asset.static === true))
    } else if (value.static === true) {
      result.push(value)
    }
  }
  return result
}
