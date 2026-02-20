import {getNestedValue} from './utils.js'
import {writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath, dirname, extname} from '@shopify/cli-kit/node/path'
import {z} from 'zod'
import type {BuildStep, BuildContext} from '../build-steps.js'

// ── Filepath ──────────────────────────────────────────────────────────────

/**
 * Prefix component of a composed filepath.
 *
 * - string: a literal value (e.g. "my-prefix")
 * - {tomlKey}: resolved from the current forEach item first, falling back to
 *   the top-level extension config. If the resolved value is a scalar string
 *   it is used as-is. If it resolves to an array the current iteration index
 *   is used instead.
 */
const FilepathPrefixSchema = z.union([z.string(), z.object({tomlKey: z.string()})])

/**
 * Composed filepath assembled as: `{path/}{prefix}{filename}`
 *
 * Example: path="dist", prefix={tomlKey:"handle"}, filename=".js"
 *   → "dist/my-ext.js"
 */
const ComposedFilepathSchema = z.object({
  path: z.string().optional(),
  prefix: FilepathPrefixSchema,
  filename: z.string(),
})

/**
 * A filepath value. One of:
 * - A literal string: "dist/index.js"
 * - {tomlKey}: the whole filepath resolved from the extension config
 * - A composed value built from path + prefix + filename
 */
const FilepathValueSchema = z.union([z.string(), z.object({tomlKey: z.string()}), ComposedFilepathSchema])

// ── Module ────────────────────────────────────────────────────────────────

/**
 * A module path value resolved from a TOML key.
 * In forEach context the key is looked up on the current item first,
 * falling back to the top-level extension config.
 */
const ModuleValueSchema = z.object({tomlKey: z.string()})

// ── Asset entries ─────────────────────────────────────────────────────────

/**
 * Explicit asset entry with a composed or literal filepath.
 * Set `optional: true` to silently skip the asset if any required field is absent.
 */
const ExplicitAssetEntrySchema = z.object({
  filepath: FilepathValueSchema,
  module: ModuleValueSchema.optional(),
  static: z.boolean().optional(),
  optional: z.boolean().optional(),
})

/**
 * Shorthand: resolve the entire filepath from a single tomlKey.
 * Kept for backward compatibility with existing configs.
 */
const TomlKeyAssetEntrySchema = z.object({
  tomlKey: z.string(),
  static: z.boolean().optional(),
})

const AssetEntrySchema = z.union([ExplicitAssetEntrySchema, TomlKeyAssetEntrySchema])

// ── forEach ───────────────────────────────────────────────────────────────

/**
 * Iterates over a config array and produces one manifest per item.
 * The output is an array of `{ [keyBy]: value, build_manifest: { assets } }` objects,
 * mirroring the shape that UIExtensionSchema.transform attaches to each extension_point.
 */
const ForEachSchema = z.object({
  tomlKey: z.string(), // config key pointing to an array
  keyBy: z.string(), // field in each item used to identify the manifest (e.g. 'target')
})

// ── Top-level config ──────────────────────────────────────────────────────

const BuildManifestConfigSchema = z.object({
  /** Output filename relative to the extension output directory. @default 'build-manifest.json' */
  outputFile: z.string().default('build-manifest.json'),

  /** When set, iterates over the named config array and produces one manifest per item. */
  forEach: ForEachSchema.optional(),

  /** Map of asset identifier → asset configuration. */
  assets: z.record(z.string(), AssetEntrySchema),
})

// ── Types ─────────────────────────────────────────────────────────────────

export type ResolvedAsset = {filepath: string; module?: string; static?: boolean}
export type ResolvedAssets = Record<string, ResolvedAsset | ResolvedAsset[]>
export type PerItemManifest = {[key: string]: unknown; build_manifest: {assets: ResolvedAssets}}

// ── Resolution helpers ────────────────────────────────────────────────────

function resolvePrefix(
  prefix: z.infer<typeof FilepathPrefixSchema>,
  config: Record<string, unknown>,
  item: Record<string, unknown> | null,
  index: number,
): string | undefined {
  if (typeof prefix === 'string') return prefix

  // In forEach context try the current item first (no arrayIndex — inner arrays on
  // the item are handled via expansion in resolveAssets, not indexed here).
  // Fall back to the top-level config, using the outer index for config-level arrays.
  if (item !== null) {
    const value = getNestedValue(item, prefix.tomlKey)
    if (typeof value === 'string') return value
  }

  const value = getNestedValue(config, prefix.tomlKey, index)
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return String(index)
  return undefined
}

function resolveFilepath(
  filepath: z.infer<typeof FilepathValueSchema>,
  config: Record<string, unknown>,
  item: Record<string, unknown> | null,
  index: number,
  innerIndex?: number,
): string | undefined {
  if (typeof filepath === 'string') return filepath

  // {tomlKey} shorthand — whole filepath from config
  if ('tomlKey' in filepath && !('prefix' in filepath)) {
    const value = getNestedValue(config, (filepath as {tomlKey: string}).tomlKey)
    return typeof value === 'string' ? value : undefined
  }

  // Composed: {path?, prefix, filename}
  // When innerIndex is provided (inner-array expansion), it is inserted between
  // the resolved prefix and the filename: {path/}{prefix}-{innerIndex}{filename}
  const {path, prefix, filename} = filepath as z.infer<typeof ComposedFilepathSchema>
  const resolvedPrefix = resolvePrefix(prefix, config, item, index)
  if (resolvedPrefix === undefined) return undefined
  const fullPrefix = innerIndex !== undefined ? `${resolvedPrefix}-${innerIndex}` : resolvedPrefix
  return `${path ? `${path}/` : ''}${fullPrefix}${filename}`
}

/**
 * Resolves a module tomlKey.
 *
 * Returns:
 * - `string`   — a single resolved value
 * - `string[]` — the item had a nested array for this path; the asset will be
 *                expanded into one entry per inner item by resolveAssets
 * - `undefined` — could not resolve
 */
function resolveModule(
  module: z.infer<typeof ModuleValueSchema> | undefined,
  config: Record<string, unknown>,
  item: Record<string, unknown> | null,
  index: number,
): string | string[] | undefined {
  if (module === undefined) return undefined

  // Try the current item without arrayIndex so that inner arrays are returned
  // as-is (string[]) rather than indexed — expansion is handled by resolveAssets.
  if (item !== null) {
    const value = getNestedValue(item, module.tomlKey)
    if (typeof value === 'string') return value
    if (Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'string'))
      return value as string[]
  }

  // Fall back to the top-level config, using the outer index for config-level arrays.
  const value = getNestedValue(config, module.tomlKey, index)
  return typeof value === 'string' ? value : undefined
}


function resolveAssets(
  assetsDef: Record<string, z.infer<typeof AssetEntrySchema>>,
  config: Record<string, unknown>,
  item: Record<string, unknown> | null,
  index: number,
  stdout: NodeJS.WritableStream,
): ResolvedAssets {
  const resolved: ResolvedAssets = {}

  for (const [name, entry] of Object.entries(assetsDef)) {
    // Backward-compat tomlKey shorthand (no filepath field)
    if ('tomlKey' in entry && !('filepath' in entry)) {
      const value = getNestedValue(config, (entry as {tomlKey: string}).tomlKey)
      if (typeof value === 'string') {
        resolved[name] = {filepath: value, ...(entry.static ? {static: entry.static} : {})}
      } else {
        stdout.write(`No value for tomlKey '${(entry as {tomlKey: string}).tomlKey}' in asset '${name}', skipping\n`)
      }
      continue
    }

    // Explicit entry
    const explicit = entry as z.infer<typeof ExplicitAssetEntrySchema>

    const filepath = resolveFilepath(explicit.filepath, config, item, index)
    if (filepath === undefined) {
      if (!explicit.optional) stdout.write(`Could not resolve filepath for asset '${name}', skipping\n`)
      continue
    }

    const mod = resolveModule(explicit.module, config, item, index)

    if (Array.isArray(mod)) {
      // Inner array: produce an array under the original key, mirroring the TOML structure.
      // The inner index is inserted between the config-defined prefix and the filename.
      resolved[name] = mod.map((innerMod, innerIndex) => ({
        filepath: resolveFilepath(explicit.filepath, config, item, index, innerIndex) ?? filepath,
        module: innerMod,
        ...(explicit.static ? {static: explicit.static} : {}),
      }))
      continue
    }

    if (explicit.module !== undefined && mod === undefined) {
      if (!explicit.optional) stdout.write(`Could not resolve module for asset '${name}', skipping\n`)
      continue
    }

    resolved[name] = {
      filepath,
      ...(mod !== undefined ? {module: mod} : {}),
      ...(explicit.static ? {static: explicit.static} : {}),
    }
  }

  return resolved
}

// ── Executor ──────────────────────────────────────────────────────────────

/**
 * Executes a build_manifest step.
 *
 * **Single mode** (no `forEach`): writes one manifest JSON with a flat `assets` map.
 *
 * **Per-target mode** (`forEach`): iterates the named config array and writes an array
 * of `{ [keyBy]: value, build_manifest: { assets } }` objects — one per item.
 * This mirrors the shape that `UIExtensionSchema.transform` produces on each
 * `extension_point`, making it straightforward to feed the result back into the
 * in-memory `extension.configuration.extension_points[].build_manifest`.
 *
 * Asset `filepath` values support three forms:
 * - Literal string: `"dist/index.js"`
 * - `{tomlKey}`: resolved from top-level extension config
 * - Composed `{path?, prefix, filename}`: prefix from tomlKey, itemKey, or literal
 *
 * Assets marked `optional: true` are silently skipped when their filepath or module
 * cannot be resolved.
 */
export async function executeBuildManifestStep(
  step: BuildStep,
  context: BuildContext,
): Promise<{outputFile: string; assets: ResolvedAssets} | {outputFile: string; manifests: PerItemManifest[]}> {
  const config = BuildManifestConfigSchema.parse(step.config)
  const {extension, options} = context
  const outputDir = extname(extension.outputPath) ? dirname(extension.outputPath) : extension.outputPath
  const outputFilePath = joinPath(outputDir, config.outputFile)
  const extensionConfig = extension.configuration as Record<string, unknown>

  let result: {outputFile: string; assets: Record<string, ResolvedAsset>} | {outputFile: string; manifests: PerItemManifest[]}

  if (config.forEach) {
    const array = getNestedValue(extensionConfig, config.forEach.tomlKey)

    if (!Array.isArray(array)) {
      options.stdout.write(`No array found for forEach tomlKey '${config.forEach.tomlKey}'\n`)
      await writeManifest(outputFilePath, [])
      result = {outputFile: outputFilePath, manifests: []}
    } else {
      const keyBy = config.forEach.keyBy
      const manifests: PerItemManifest[] = array.flatMap((raw, index) => {
        if (typeof raw !== 'object' || raw === null) return []
        const item = raw as Record<string, unknown>
        const assets = resolveAssets(config.assets, extensionConfig, item, index, options.stdout)
        return [{[keyBy]: getNestedValue(item, keyBy), build_manifest: {assets}} as PerItemManifest]
      })

      await writeManifest(outputFilePath, manifests)
      options.stdout.write(`Build manifest written to ${config.outputFile} (${manifests.length} entries)\n`)
      result = {outputFile: outputFilePath, manifests}
    }
  } else {
    const assets = resolveAssets(config.assets, extensionConfig, null, 0, options.stdout)
    await writeManifest(outputFilePath, {assets})
    options.stdout.write(`Build manifest written to ${config.outputFile}\n`)
    result = {outputFile: outputFilePath, assets}
  }

  return result
}

async function writeManifest(outputFilePath: string, content: unknown): Promise<void> {
  await mkdir(dirname(outputFilePath))
  await writeFile(outputFilePath, JSON.stringify(content, null, 2))
}
