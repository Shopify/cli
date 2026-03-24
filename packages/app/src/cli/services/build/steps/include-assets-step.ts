import {copyByPattern} from './include-assets/copy-by-pattern.js'
import {copySourceEntry} from './include-assets/copy-source-entry.js'
import {copyConfigKeyEntry} from './include-assets/copy-config-key-entry.js'
import {joinPath, dirname, extname, sanitizeRelativePath} from '@shopify/cli-kit/node/path'
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
      const sanitizedDest = entry.destination !== undefined ? sanitizeRelativePath(entry.destination, warn) : undefined

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
