import {generateManifestFile, resolveOutputDir} from './include-assets/generate-manifest.js'
import {copyByPattern} from './include-assets/copy-by-pattern.js'
import {copySourceEntry} from './include-assets/copy-source-entry.js'
import {copyConfigKeyEntry} from './include-assets/copy-config-key-entry.js'
import {joinPath, sanitizeRelativePath} from '@shopify/cli-kit/node/path'
import {z} from 'zod'
import type {LifecycleStep, BuildContext} from '../client-steps.js'

export type {IncludeAssetsConfig}

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
 * key is absent.
 *
 * `anchor` — the config key path whose array value provides the grouping
 * dimension. Each array item becomes one top-level manifest entry, keyed by
 * its `groupBy` field value.
 *
 * `groupBy` — the field name within each anchor array item whose string value
 * becomes the manifest key (e.g. `"target"` → `manifest["admin.link"] = {...}`).
 *
 * Both `anchor` and `groupBy` must be set together or both omitted.
 */
const ConfigKeyEntrySchema = z.object({
  type: z.literal('configKey'),
  key: z.string(),
  destination: z.string().optional(),
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
 * When `generatesAssetsManifest` is `true`, a `manifest.json` file is written
 * to the output directory after all inclusions complete. All entry types
 * contribute their copied output paths to the manifest. `configKey` entries
 * with `anchor` and `groupBy` produce structured manifest entries; `pattern`
 * and `static` entries contribute their paths under a `"files"` key.
 */
const IncludeAssetsConfigSchema = z
  .object({
    inclusions: z.array(InclusionEntrySchema),
    generatesAssetsManifest: z.boolean().default(false),
  })
  .strict()
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
 * TypeScript type for the include_assets step config.
 * Derived from the Zod schema so that static type-checking catches
 * mismatched property names at compile time.
 */
type IncludeAssetsConfig = z.input<typeof IncludeAssetsConfigSchema>

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
 *
 * When `generatesAssetsManifest` is `true`, all entry types contribute their
 * copied output paths to `manifest.json`.
 */
export async function executeIncludeAssetsStep(
  step: LifecycleStep,
  context: BuildContext,
): Promise<{filesCopied: number}> {
  const config = IncludeAssetsConfigSchema.parse(step.config)
  const {extension, options} = context
  const outputDir = resolveOutputDir(extension.outputPath)

  const aggregatedPathMap = new Map<string, string | string[]>()
  // Track basenames written across all configKey entries in this build to detect
  // true conflicts (different sources, same basename) while allowing overwrites
  // from previous builds.
  const usedBasenames = new Set<string>()

  // configKey entries run sequentially to avoid filesystem race conditions
  // when multiple entries target the same output directory.
  let configKeyCount = 0
  for (const entry of config.inclusions) {
    if (entry.type !== 'configKey') continue
    const warn = (msg: string) => options.stdout.write(msg)
    const rawDest = entry.destination ? sanitizeRelativePath(entry.destination, warn) : undefined
    const sanitizedDest = rawDest === '' ? undefined : rawDest
    // eslint-disable-next-line no-await-in-loop
    const result = await copyConfigKeyEntry({
      key: entry.key,
      baseDir: extension.directory,
      outputDir,
      context,
      destination: sanitizedDest,
      usedBasenames,
    })
    result.pathMap.forEach((val, key) => aggregatedPathMap.set(key, val))
    configKeyCount += result.filesCopied
  }

  const otherResults = await Promise.all(
    config.inclusions
      .filter((entry) => entry.type !== 'configKey')
      .map(async (entry) => {
        const warn = (msg: string) => options.stdout.write(msg)
        const rawDest = entry.destination ? sanitizeRelativePath(entry.destination, warn) : undefined
        const sanitizedDest = rawDest === '' ? undefined : rawDest

        if (entry.type === 'pattern') {
          const sourceDir = entry.baseDir ? joinPath(extension.directory, entry.baseDir) : extension.directory
          const destinationDir = sanitizedDest ? joinPath(outputDir, sanitizedDest) : outputDir
          const result = await copyByPattern(
            {
              sourceDir,
              outputDir: destinationDir,
              patterns: entry.include,
              ignore: entry.ignore ?? [],
            },
            options,
          )
          // result.outputPaths are relative to destinationDir; prefix with sanitizedDest for outer outputDir relativity
          const outputPaths = sanitizedDest
            ? result.outputPaths.map((outputPath) => joinPath(sanitizedDest, outputPath))
            : result.outputPaths
          return {filesCopied: result.filesCopied, outputPaths}
        }

        if (entry.type === 'static') {
          return copySourceEntry(
            {
              source: entry.source,
              destination: sanitizedDest,
              baseDir: extension.directory,
              outputDir,
            },
            options,
          )
        }
      }),
  )

  const otherFiles = config.generatesAssetsManifest ? otherResults.flatMap((result) => result?.outputPaths ?? []) : []

  const counts = [configKeyCount, ...otherResults.map((result) => result?.filesCopied ?? 0)]

  if (config.generatesAssetsManifest) {
    const configKeyEntries = config.inclusions.filter((entry) => entry.type === 'configKey')
    await generateManifestFile(configKeyEntries, context, aggregatedPathMap, otherFiles)
  }

  return {filesCopied: counts.reduce<number>((sum, count) => sum + (count ?? 0), 0)}
}
