import type {BuildStep, BuildContext, ConfigurableValue} from '../build-steps.js'
import {resolveConfigurableValue, isOptionalReference, isReference} from '../build-steps.js'
import {joinPath, dirname, relativePath, basename} from '@shopify/cli-kit/node/path'
import {glob, copyFile, copyDirectoryContents, fileExists, mkdir} from '@shopify/cli-kit/node/fs'
import {z} from 'zod'

/**
 * Zod schema for a configurable value (literal or reference).
 * Accepts either a literal value of type T, or a reference object.
 */
const configurableValueSchema = <T extends z.ZodTypeAny>(literalSchema: T) =>
  z.union([
    literalSchema,
    z.object({configPath: z.string(), optional: z.boolean().optional()}),
    z.object({envVar: z.string(), optional: z.boolean().optional()}),
  ])

/**
 * Configuration schema for copy_files step.
 * Uses Zod for runtime validation of step configuration.
 * Supports ConfigurableValue for dynamic resolution from extension config.
 */
const CopyFilesConfigSchema = z.object({
  /** Source directory or file pattern (relative to extension directory) */
  source: configurableValueSchema(z.string()).optional(),

  /** Destination directory (relative to outputPath) */
  destination: configurableValueSchema(z.string()).optional(),

  /** Glob patterns for files to include */
  patterns: configurableValueSchema(z.array(z.string())).optional(),

  /** Glob patterns for files to exclude */
  ignore: configurableValueSchema(z.array(z.string())).optional(),

  /** Copy strategy: 'directory' | 'files' | 'pattern' */
  strategy: z.enum(['directory', 'files', 'pattern']).default('pattern'),

  /** Preserve directory structure (default: true) */
  preserveStructure: z.boolean().default(true),

  /** File list (for 'files' strategy) */
  files: z
    .array(
      z.object({
        source: configurableValueSchema(z.string()),
        destination: configurableValueSchema(z.string()),
      }),
    )
    .optional(),
})

type CopyFilesConfig = z.infer<typeof CopyFilesConfigSchema>

/**
 * Resolved configuration after ConfigurableValues have been resolved to their actual values.
 */
interface ResolvedCopyFilesConfig {
  strategy: 'directory' | 'files' | 'pattern'
  source?: string
  destination?: string
  patterns?: string[]
  ignore?: string[]
  preserveStructure: boolean
  files?: Array<{source: string; destination: string}>
}

/**
 * Executes a copy_files build step.
 * Supports three strategies: directory, files, pattern.
 *
 * @param step - The copy_files step configuration
 * @param context - The build context
 * @returns Result with number of files copied
 */
export async function executeCopyFilesStep(
  step: BuildStep,
  context: BuildContext,
): Promise<{filesCopied: number}> {
  // Validate and parse configuration
  const config = CopyFilesConfigSchema.parse(step.config)
  const {extension, options} = context

  // Resolve configurable values from extension config
  const resolvedSource = resolveConfigurableValue(config.source, context)
  const resolvedDestination = resolveConfigurableValue(config.destination, context)
  const resolvedPatterns = resolveConfigurableValue(config.patterns, context)
  const resolvedIgnore = resolveConfigurableValue(config.ignore, context)

  // Resolve file list if present
  const resolvedFiles = config.files?.map((file) => ({
    source: resolveConfigurableValue(file.source, context) ?? '',
    destination: resolveConfigurableValue(file.destination, context) ?? '',
  }))

  // Create resolved config object
  const resolvedConfig: ResolvedCopyFilesConfig = {
    strategy: config.strategy,
    source: resolvedSource,
    destination: resolvedDestination,
    patterns: resolvedPatterns,
    ignore: resolvedIgnore,
    preserveStructure: config.preserveStructure,
    files: resolvedFiles,
  }

  // Handle when source is a reference that resolves to undefined
  // (e.g., {configPath: 'static_root', optional: true} but static_root is not in TOML)
  // Note: If config.source is undefined (not specified), that's okay - we'll use extension directory
  if (
    config.source !== undefined &&
    isReference(config.source) &&
    resolvedConfig.source === undefined &&
    (config.strategy === 'directory' || config.strategy === 'pattern')
  ) {
    // Check if the source is an optional reference
    if (isOptionalReference(config.source)) {
      // If optional, skip silently with a log message
      options.stdout.write(
        `Skipping ${step.displayName}: source is not configured (resolved to undefined)\n`,
      )
      return {filesCopied: 0}
    }
    // If source is a required reference that resolved to undefined, throw a clear error
    throw new Error(
      `Build step "${step.displayName}" failed: source configuration is required but resolved to undefined. ` +
        `Check that the referenced config field exists in your TOML file.`,
    )
  }

  // Determine source and output directories
  const sourceDir = resolvedConfig.source
    ? joinPath(extension.directory, resolvedConfig.source)
    : extension.directory

  const outputDir = resolvedConfig.destination
    ? joinPath(dirname(extension.outputPath), resolvedConfig.destination)
    : dirname(extension.outputPath)

  // Execute based on strategy
  switch (resolvedConfig.strategy) {
    case 'directory':
      return copyDirectory(sourceDir, outputDir, resolvedConfig, options)
    case 'files':
      return copyFileList(resolvedFiles || [], sourceDir, outputDir, resolvedConfig, options)
    case 'pattern':
      return copyByPattern(sourceDir, outputDir, resolvedConfig, options)
    default:
      throw new Error(`Unknown copy strategy: ${resolvedConfig.strategy}`)
  }
}

/**
 * Strategy: Copy entire directory contents
 */
async function copyDirectory(
  sourceDir: string,
  outputDir: string,
  config: ResolvedCopyFilesConfig,
  options: {stdout: NodeJS.WritableStream; stderr: NodeJS.WritableStream},
): Promise<{filesCopied: number}> {
  const exists = await fileExists(sourceDir)

  if (!exists) {
    throw new Error(`Source directory does not exist: ${sourceDir}`)
  }

  // Ensure output directory exists
  await mkdir(outputDir)

  // Copy entire directory
  await copyDirectoryContents(sourceDir, outputDir)
  options.stdout.write(`Copied directory ${sourceDir} to ${outputDir}\n`)

  // Count files copied
  const files = await glob(['**/*'], {cwd: outputDir, absolute: false})
  return {filesCopied: files.length}
}

/**
 * Strategy: Copy files matching glob patterns
 */
async function copyByPattern(
  sourceDir: string,
  outputDir: string,
  config: ResolvedCopyFilesConfig,
  options: {stdout: NodeJS.WritableStream; stderr: NodeJS.WritableStream},
): Promise<{filesCopied: number}> {
  const patterns = config.patterns || ['**/*']
  const ignore = config.ignore || []

  // Find matching files
  const files = await glob(patterns, {
    absolute: true,
    cwd: sourceDir,
    ignore,
  })

  if (files.length === 0) {
    options.stdout.write(`Warning: No files matched patterns in ${sourceDir}\n`)
    return {filesCopied: 0}
  }

  // Ensure output directory exists
  await mkdir(outputDir)

  // Copy each file
  await Promise.all(
    files.map(async (filepath) => {
      const relPath = config.preserveStructure ? relativePath(sourceDir, filepath) : basename(filepath)

      const destPath = joinPath(outputDir, relPath)

      // Skip if source and destination are the same
      if (filepath === destPath) return

      // Ensure destination directory exists
      await mkdir(dirname(destPath))

      // Copy file
      await copyFile(filepath, destPath)
    }),
  )

  options.stdout.write(`Copied ${files.length} file(s) from ${sourceDir} to ${outputDir}\n`)
  return {filesCopied: files.length}
}

/**
 * Strategy: Copy specific file list
 */
async function copyFileList(
  files: Array<{source: string; destination: string}>,
  sourceDir: string,
  outputDir: string,
  config: ResolvedCopyFilesConfig,
  options: {stdout: NodeJS.WritableStream; stderr: NodeJS.WritableStream},
): Promise<{filesCopied: number}> {
  if (files.length === 0) {
    options.stdout.write('No files specified in file list\n')
    return {filesCopied: 0}
  }

  // Ensure output directory exists
  await mkdir(outputDir)

  let copiedCount = 0

  await Promise.all(
    files.map(async ({source, destination}) => {
      const sourcePath = joinPath(sourceDir, source)
      const destPath = joinPath(outputDir, destination)

      // Skip if source and destination are the same
      if (sourcePath === destPath) return

      // Check if source exists
      const exists = await fileExists(sourcePath)
      if (!exists) {
        throw new Error(`Source file does not exist: ${sourcePath}`)
      }

      // Ensure destination directory exists
      await mkdir(dirname(destPath))

      // Copy file
      await copyFile(sourcePath, destPath)
      copiedCount++
    }),
  )

  options.stdout.write(`Copied ${copiedCount} file(s) to ${outputDir}\n`)
  return {filesCopied: copiedCount}
}
