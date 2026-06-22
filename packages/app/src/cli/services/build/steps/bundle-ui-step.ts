import {createOrUpdateManifestFile} from './include-assets/generate-manifest.js'
import {buildUIExtension} from '../extension.js'
import {BuildManifest} from '../../../models/extensions/specifications/ui_extension.js'
import {copyFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath, resolvePath} from '@shopify/cli-kit/node/path'
import type {BundleUIStep, BuildContext} from '../client-steps.js'

interface ExtensionPointWithBuildManifest {
  target: string
  build_manifest: BuildManifest
}

/**
 * Executes a bundle_ui build step.
 *
 * Bundles the UI extension using esbuild into the extension's local directory
 * and copies the output to the bundle. When enabled, writes built asset entries
 * (from build_manifest) into manifest.json so downstream steps can merge on top.
 */
export async function executeBundleUIStep(step: BundleUIStep, context: BuildContext): Promise<void> {
  const config = context.extension.configuration
  context.options.buildDirectory = step.config?.bundleFolder ?? undefined
  const localOutputPath = await buildUIExtension(context.extension, context.options)
  const localOutputDir = dirname(localOutputPath)
  const bundleOutputDir = step.config?.bundleFolder
    ? joinPath(dirname(context.extension.outputPath), step.config.bundleFolder)
    : dirname(context.extension.outputPath)

  // If the final output path is the same as the local one: don't copy the results and don't generate manifests.
  if (resolvePath(localOutputDir) === resolvePath(bundleOutputDir)) return

  await copyFile(localOutputDir, bundleOutputDir)

  if (!shouldGenerateAssetsManifest(step, context)) return

  if (!Array.isArray(config.extension_points)) return

  const pointsWithManifest = config.extension_points.filter(
    (ep): ep is ExtensionPointWithBuildManifest => typeof ep === 'object' && ep.build_manifest,
  )

  const entries = extractBuiltAssetEntries(pointsWithManifest, step.config?.bundleFolder)
  if (Object.keys(entries).length > 0) {
    await createOrUpdateManifestFile(context, entries)
  }
}

function shouldGenerateAssetsManifest(step: BundleUIStep, context: BuildContext): boolean {
  if (!step.config?.generatesAssetsManifest) return false
  if (context.options.environment !== 'production') return true
  if (!step.config.skipAssetsManifestWithoutConfigAssetsInProduction) return true

  return hasConfigDrivenManifestAssets(context.extension.configuration.extension_points)
}

function hasConfigDrivenManifestAssets(extensionPoints: unknown): boolean {
  if (!Array.isArray(extensionPoints)) return false

  return extensionPoints.some((extensionPoint) => {
    if (!extensionPoint || typeof extensionPoint !== 'object' || Array.isArray(extensionPoint)) return false

    const point = extensionPoint as Record<string, unknown>
    return (
      hasManifestAssetValue(point.assets) ||
      hasManifestAssetValue(point.tools) ||
      hasManifestAssetValue(point.instructions) ||
      hasManifestAssetValue(point.intents)
    )
  })
}

function hasManifestAssetValue(value: unknown): boolean {
  if (typeof value === 'string') return value.length > 0
  if (Array.isArray(value)) return value.some(hasManifestAssetValue)
  if (value && typeof value === 'object') return Object.values(value).some(hasManifestAssetValue)
  return false
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
