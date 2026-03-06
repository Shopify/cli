import {getNestedValue} from './utils.js'
import {writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath, dirname, extname} from '@shopify/cli-kit/node/path'
import {z} from 'zod'
import type {ClientStep, BuildContext} from '../client-steps.js'

// ── forEach ───────────────────────────────────────────────────────────────

/**
 * Iterates over a config array and produces one manifest per item.
 * The output is an array of `{ [keyBy]: value, build_manifest: { assets } }` objects,
 * mirroring the shape that UIExtensionSchema.transform attaches to each extension_point.
 */
const ForEachSchema = z.object({
  // config key pointing to an array
  tomlKey: z.string(),
  // field in each item used to identify the manifest (e.g. 'target')
  keyBy: z.string(),
})

// ── Asset entry ───────────────────────────────────────────────────────────

/**
 * Configuration for a single asset in the manifest.
 *
 * The asset filepath is always derived from the extension handle, the current
 * forEach keyBy value (when iterating), and the asset map key:
 *   `{handle}-{keyByValue}-{assetKey}{extension}` (forEach mode)
 *   `{handle}-{assetKey}{extension}`               (single mode)
 *
 * For inner-array module resolution the index is inserted before the extension:
 *   `{handle}-{keyByValue}-{assetKey}-{index}{extension}`
 */
const AssetEntrySchema = z.object({
  /**
   * The extension config key whose value is the source module path.
   * Resolved from the current forEach item first, falling back to the
   * top-level extension config (dot-notation supported, e.g. `'should_render.module'`).
   */
  moduleKey: z.string(),

  /**
   * When true, the asset is a static file to be copied rather than a bundle entry.
   * Static assets use the source module's own file extension in the generated filepath.
   * Non-static (bundled) assets always use `.js`.
   */
  static: z.boolean().optional(),

  /**
   * When true, the asset is silently omitted from the manifest if its module
   * tomlKey cannot be resolved. Non-optional assets log a warning and are skipped.
   */
  optional: z.boolean().optional(),
})

// ── Top-level config ──────────────────────────────────────────────────────

const BuildManifestConfigSchema = z.object({
  /** Output filename relative to the extension output directory. Defaults to `'build-manifest.json'`. */
  outputFile: z.string().default('build-manifest.json'),

  /** When set, iterates over the named config array and produces one manifest per item. */
  forEach: ForEachSchema.optional(),

  /** Map of asset identifier → asset configuration. */
  assets: z.record(z.string(), AssetEntrySchema),
})

// ── Types ─────────────────────────────────────────────────────────────────

export interface ResolvedAsset {
  filepath: string
  module?: string
  static?: boolean
}
export interface ResolvedAssets {
  [key: string]: ResolvedAsset | ResolvedAsset[]
}
export interface PerItemManifest {
  [key: string]: unknown
  build_manifest: {assets: ResolvedAssets}
}

export type BuildManifestStepOutput =
  | {outputFile: string; assets: ResolvedAssets}
  | {outputFile: string; manifests: PerItemManifest[]}

// ── Filepath generation ───────────────────────────────────────────────────

/**
 * Generates a deterministic filepath for a manifest asset.
 *
 * Format:
 * - Single mode:  `{handle}-{assetKey}{extension}`
 * - forEach mode: `{handle}-{keyByValue}-{assetKey}{extension}`
 * - Inner array:  `{handle}-{keyByValue}-{assetKey}-{index}{extension}`
 *
 * `keyByValue` is the resolved value of the `forEach.keyBy` field on the current
 * iteration item (e.g. the value of `target` when `keyBy: 'target'`).
 */
function generateFilepath(
  handle: string,
  keyByValue: string | undefined,
  assetKey: string,
  extension: string,
  innerIndex?: number,
): string {
  const base = keyByValue !== undefined ? `${handle}-${keyByValue}-${assetKey}` : `${handle}-${assetKey}`
  return innerIndex !== undefined ? `${base}-${innerIndex}${extension}` : `${base}${extension}`
}

// ── Module resolution ─────────────────────────────────────────────────────

/**
 * Resolves the module path for an asset entry.
 *
 * Lookup order (forEach context):
 *   1. `item[tomlKey]`  — current iteration item
 *   2. `config[tomlKey]` — top-level extension config
 *
 * In single mode `item` is `null` and only the config is consulted.
 *
 * Returns:
 * - `string`   — a single resolved module path
 * - `string[]` — the resolved key was an inner array; the asset will be
 *                expanded into one entry per element by `resolveAssets`
 * - `undefined` — could not resolve
 */
function resolveModule(
  entry: z.infer<typeof AssetEntrySchema>,
  config: {[key: string]: unknown},
  item: {[key: string]: unknown} | null,
): string | string[] | undefined {
  const key = entry.moduleKey

  if (item !== null) {
    const value = getNestedValue(item, key)
    if (typeof value === 'string') return value
    if (Array.isArray(value) && value.length > 0 && value.every((val) => typeof val === 'string')) return value
  }

  const value = getNestedValue(config, key)
  return typeof value === 'string' ? value : undefined
}

// ── Asset resolution ──────────────────────────────────────────────────────

/**
 * Derives the output file extension for an asset.
 *
 * - Static assets preserve the source module's own extension (e.g. `tools.json` → `.json`).
 * - Bundled assets always output `.js` regardless of the source extension (`.tsx` → `.js`).
 */
function deriveExtension(modulePath: string, isStatic: boolean | undefined): string {
  if (isStatic) return extname(modulePath) || '.js'
  return '.js'
}

function resolveAssets(
  assetsDef: {[key: string]: z.infer<typeof AssetEntrySchema>},
  config: {[key: string]: unknown},
  item: {[key: string]: unknown} | null,
  keyByValue: string | undefined,
  stdout: NodeJS.WritableStream,
): ResolvedAssets {
  const handle = config.handle
  if (typeof handle !== 'string') {
    throw new Error("Extension config must have a 'handle' field to generate asset filepaths")
  }

  const resolved: ResolvedAssets = {}

  for (const [assetKey, entry] of Object.entries(assetsDef)) {
    const mod = resolveModule(entry, config, item)

    if (mod === undefined) {
      if (!entry.optional) stdout.write(`Could not resolve module for asset '${assetKey}', skipping\n`)
      continue
    }

    if (Array.isArray(mod)) {
      // Inner array: expand into one entry per element, inserting the index before the extension.
      // Each element uses its own source extension when static, otherwise '.js'.
      resolved[assetKey] = mod.map((innerMod, innerIndex) => ({
        filepath: generateFilepath(handle, keyByValue, assetKey, deriveExtension(innerMod, entry.static), innerIndex),
        module: innerMod,
        ...(entry.static ? {static: entry.static} : {}),
      }))
      continue
    }

    resolved[assetKey] = {
      filepath: generateFilepath(handle, keyByValue, assetKey, deriveExtension(mod, entry.static)),
      module: mod,
      ...(entry.static ? {static: entry.static} : {}),
    }
  }

  return resolved
}

// ── Executor ──────────────────────────────────────────────────────────────

/**
 * Executes a build_manifest step.
 *
 * **Single mode** (no `forEach`): writes one manifest JSON with a flat `assets` map.
 * Each asset filepath is `{handle}-{assetKey}{extension}`.
 *
 * **forEach mode**: iterates the named config array and writes an array of
 * `{ [keyBy]: value, build_manifest: { assets } }` objects — one per item.
 * Each asset filepath is `{handle}-{keyByValue}-{assetKey}{extension}` where
 * `keyByValue` is the resolved value of the `forEach.keyBy` field on the item.
 * This mirrors the shape that `UIExtensionSchema.transform` produces on each
 * `extension_point`, making it straightforward to feed the result back into the
 * in-memory `extension.configuration.extension_points[].build_manifest`.
 *
 * When a module tomlKey resolves to an inner string array the asset is expanded:
 * one entry per element, with the index inserted before the extension:
 * `{handle}-{keyByValue}-{assetKey}-{index}{extension}`.
 *
 * Assets marked `optional: true` are silently omitted when their module key
 * cannot be resolved.
 */
export async function executeBuildManifestStep(
  step: ClientStep,
  context: BuildContext,
): Promise<BuildManifestStepOutput> {
  const config = BuildManifestConfigSchema.parse(step.config)
  const {extension, options} = context
  const outputDir = extname(extension.outputPath) ? dirname(extension.outputPath) : extension.outputPath
  const outputFilePath = joinPath(outputDir, config.outputFile)
  const extensionConfig = extension.configuration as {[key: string]: unknown}

  let result: BuildManifestStepOutput

  if (config.forEach) {
    const array = getNestedValue(extensionConfig, config.forEach.tomlKey)

    if (Array.isArray(array)) {
      const keyBy = config.forEach.keyBy
      const manifests: PerItemManifest[] = array.flatMap((raw, _index) => {
        if (typeof raw !== 'object' || raw === null) return []
        const item = raw as {[key: string]: unknown}
        const keyByValue = String(getNestedValue(item, keyBy) ?? '')
        const assets = resolveAssets(config.assets, extensionConfig, item, keyByValue, options.stdout)
        return [{[keyBy]: getNestedValue(item, keyBy), build_manifest: {assets}} as PerItemManifest]
      })

      await writeManifest(outputFilePath, manifests)
      options.stdout.write(`Build manifest written to ${config.outputFile} (${manifests.length} entries)\n`)
      result = {outputFile: outputFilePath, manifests}
    } else {
      options.stdout.write(`No array found for forEach tomlKey '${config.forEach.tomlKey}'\n`)
      await writeManifest(outputFilePath, [])
      result = {outputFile: outputFilePath, manifests: []}
    }
  } else {
    const assets = resolveAssets(config.assets, extensionConfig, null, undefined, options.stdout)
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
