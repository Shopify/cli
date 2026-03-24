import {generateManifestFile} from './include-assets/generate-manifest.js'
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
 */
const PatternEntrySchema = z.object({
  type: z.literal('pattern'),
  baseDir: z.string().optional(),
  include: z.array(z.string()).default(['**/*']),
  ignore: z.array(z.string()).optional(),
  destination: z.string().optional(),
})

/**
 * Static inclusion entry — explicit source path.
 *
 * Copies source to destination. Without `destination`, copies directory under its own name in the output.
 */
const StaticEntrySchema = z.object({
  type: z.literal('static'),
  source: z.string(),
  destination: z.string().optional(),
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
 * (`'static'`, `'configKey'`, or `'pattern'`). `configKey` entries run
 * sequentially (to avoid filesystem race conditions on shared output paths),
 * then `pattern` and `static` entries run in parallel.
 *
 * When `generateManifest` is `true`, a `manifest.json` file is written to the
 * output directory after all inclusions complete. Only `configKey` entries
 * that have both `anchor` and `groupBy` set participate in manifest generation.
 */
const IncludeAssetsConfigSchema = z
  .object({
    inclusions: z.array(InclusionEntrySchema),
    generateManifest: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    for (const [i, entry] of data.inclusions.entries()) {
      if (entry.type === 'configKey') {
        const hasAnchor = entry.anchor !== undefined
        const hasGroupBy = entry.groupBy !== undefined
        if (hasAnchor !== hasGroupBy) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: '`anchor` and `groupBy` must both be set or both be omitted',
            path: ['inclusions', i],
          })
        }
      }
    }
  })

/**
 * Executes an include_assets build step.
 *
 * Iterates over `config.inclusions` and dispatches each entry by type:
 *
 * - `type: 'static'` — copy a file or directory into the output.
 * - `type: 'configKey'` — resolve a path from the extension's
 *   config and copy into the output; silently skipped if absent.
 *   Runs sequentially to avoid filesystem race conditions.
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

  const aggregatedPathMap = new Map<string, string | string[]>()

  // configKey entries run sequentially: copyConfigKeyEntry uses findUniqueDestPath
  // which checks filesystem state before writing. Running two configKey entries in
  // parallel against the same output directory can cause both to see the same
  // candidate path as free and silently overwrite each other.
  let configKeyCount = 0
  for (const entry of config.inclusions) {
    if (entry.type !== 'configKey') continue
    const warn = (msg: string) => options.stdout.write(msg)
    const rawDest = entry.destination !== undefined ? sanitizeRelativePath(entry.destination, warn) : undefined
    const sanitizedDest = rawDest === '' ? undefined : rawDest
    // eslint-disable-next-line no-await-in-loop
    const result = await copyConfigKeyEntry(
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
    result.pathMap.forEach((val, key) => aggregatedPathMap.set(key, val))
    configKeyCount += result.filesCopied
  }

  // pattern and static entries do not use findUniqueDestPath and do not
  // contribute to the pathMap, so they are safe to run in parallel.
  const otherCounts = await Promise.all(
    config.inclusions
      .filter((entry) => entry.type !== 'configKey')
      .map(async (entry) => {
        const warn = (msg: string) => options.stdout.write(msg)
        const rawDest = entry.destination !== undefined ? sanitizeRelativePath(entry.destination, warn) : undefined
        const sanitizedDest = rawDest === '' ? undefined : rawDest

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

  const counts = [configKeyCount, ...otherCounts]

  if (config.generateManifest) {
    const configKeyEntries = config.inclusions.filter((entry) => entry.type === 'configKey')
    await generateManifestFile(configKeyEntries, context, outputDir, aggregatedPathMap)
  }

  return {filesCopied: counts.reduce<number>((sum, count) => sum + (count ?? 0), 0)}
}
