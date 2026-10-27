import {createOrUpdateManifestFile} from './include-assets/generate-manifest.js'
import {buildUIExtension} from '../extension.js'
import {BuildManifest} from '../../../models/extensions/specifications/ui_extension.js'
import {copyFile, fileExists} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath, resolvePath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {BundleUIStep, BuildContext} from '../client-steps.js'
import type {ExtensionInstance} from '../../../models/extensions/extension-instance.js'

interface ExtensionPointWithBuildManifest {
  target: string
  build_manifest: BuildManifest
}

/** Targeting entry that declares a module to bundle. */
interface PointWithModule {
  target: string
  module: string
}

/**
 * Returns the points that declare a bundled module, preferring the transformed
 * `extension_points` (ui_extension) and falling back to raw `targeting` entries
 * for contract-based specs like admin_link.
 */
function pointsWithModules(config: {extension_points?: unknown; targeting?: unknown}): PointWithModule[] {
  const points = Array.isArray(config.extension_points) ? config.extension_points : config.targeting
  if (!Array.isArray(points)) return []
  return points.filter(
    (point): point is PointWithModule =>
      typeof point === 'object' &&
      point !== null &&
      typeof point.module === 'string' &&
      typeof point.target === 'string',
  )
}

/**
 * Executes a bundle_ui build step.
 *
 * Bundles the UI extension using esbuild into the extension's local directory
 * and copies the output to the bundle. When `generatesAssetsManifest` is true,
 * writes built asset entries into manifest.json so downstream steps can merge
 * on top: from `build_manifest` on transformed extension points, or from the
 * declared `module` on raw targeting entries.
 */
export async function executeBundleUIStep(step: BundleUIStep, context: BuildContext): Promise<void> {
  const config = context.extension.configuration
  const points = pointsWithModules(config)

  // A manifest-driven step for a spec without transformed extension points (e.g.
  // admin_link) has nothing to bundle when no targeting entry declares a module.
  // A plain admin link must build exactly as it did before previews existed.
  if (step.config?.generatesAssetsManifest && !Array.isArray(config.extension_points) && points.length === 0) return

  context.options.buildDirectory = step.config?.bundleFolder ?? undefined
  const localOutputPath = await buildUIExtension(context.extension, context.options)
  const localOutputDir = dirname(localOutputPath)
  const bundleOutputDir = step.config?.bundleFolder
    ? joinPath(dirname(context.extension.outputPath), step.config.bundleFolder)
    : dirname(context.extension.outputPath)

  // If the final output path is the same as the local one: don't copy the results and don't generate manifests.
  if (resolvePath(localOutputDir) === resolvePath(bundleOutputDir)) return

  // Nothing was built, usually `deploy --no-build`. A developer condition, not a
  // CLI defect, so keep it out of crash reporting.
  if (!(await fileExists(localOutputDir))) {
    throw new AbortError(
      `Couldn't find the build output at ${localOutputDir}`,
      'If you passed --no-build, build the app first. Otherwise check that building the extension produces files at that path.',
    )
  }

  await copyFile(localOutputDir, bundleOutputDir)

  if (!step.config?.generatesAssetsManifest) return

  const entries = manifestEntries(config, context.extension, step.config?.bundleFolder)
  if (Object.keys(entries).length > 0) {
    await createOrUpdateManifestFile(context, entries)
  }
}

/**
 * Builds the manifest entries for built assets, grouped by target. Points with a
 * `build_manifest` contribute their declared assets; points with only a `module`
 * (contract-based specs) contribute the extension's single output file as `main`.
 */
function manifestEntries(
  config: {extension_points?: unknown; targeting?: unknown},
  extension: ExtensionInstance,
  bundleFolder?: string,
): {[target: string]: {[assetName: string]: string}} {
  const points = Array.isArray(config.extension_points) ? config.extension_points : config.targeting
  if (!Array.isArray(points)) return {}

  const entries: {[target: string]: {[assetName: string]: string}} = {}
  const pointsWithManifest = points.filter(
    (ep): ep is ExtensionPointWithBuildManifest => typeof ep === 'object' && ep !== null && ep.build_manifest,
  )
  for (const [target, assets] of Object.entries(extractBuiltAssetEntries(pointsWithManifest, bundleFolder))) {
    entries[target] = assets
  }

  for (const point of pointsWithModules(config)) {
    if (entries[point.target] !== undefined) continue
    const filepath = bundleFolder ? joinPath(bundleFolder, extension.outputRelativePath) : extension.outputRelativePath
    if (filepath === '') continue
    entries[point.target] = {main: filepath}
  }

  return entries
}

/**
 * Extracts built asset filepaths from `build_manifest` on each extension point,
 * grouped by target. Returns a map of target → `{assetName: filepath}`.
 */
function extractBuiltAssetEntries(
  extensionPoints: {target: string; build_manifest: BuildManifest}[],
  bundleFolder?: string,
): {
  [target: string]: {[assetName: string]: string}
} {
  const entries: {[target: string]: {[assetName: string]: string}} = {}
  for (const {target, build_manifest: buildManifest} of extensionPoints) {
    if (!buildManifest?.assets) continue
    const assets: {[name: string]: string} = {}
    for (const [name, asset] of Object.entries(buildManifest.assets)) {
      if (asset?.filepath) assets[name] = bundleFolder ? joinPath(bundleFolder, asset.filepath) : asset.filepath
    }
    if (Object.keys(assets).length > 0) entries[target] = assets
  }
  return entries
}
