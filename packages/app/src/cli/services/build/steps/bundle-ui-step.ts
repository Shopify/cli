import {createOrUpdateManifestFile} from './include-assets/generate-manifest.js'
import {buildUIExtension} from '../extension.js'
import {BuildManifest} from '../../../models/extensions/specifications/ui_extension.js'
import {copyFile} from '@shopify/cli-kit/node/fs'
import {dirname} from '@shopify/cli-kit/node/path'
import type {BundleUIStep, BuildContext} from '../client-steps.js'

interface ExtensionPointWithBuildManifest {
  target: string
  build_manifest: BuildManifest
}

/**
 * Executes a bundle_ui build step.
 *
 * Bundles the UI extension using esbuild into the extension's local directory
 * and copies the output to the bundle. When `generatesAssetsManifest` is true,
 * writes built asset entries (from build_manifest) into manifest.json so
 * downstream steps can merge on top.
 */
export async function executeBundleUIStep(step: BundleUIStep, context: BuildContext): Promise<void> {
  const config = context.extension.configuration
  const localOutputPath = await buildUIExtension(context.extension, context.options)
  // Copy the locally built files into the bundle
  await copyFile(dirname(localOutputPath), dirname(context.extension.outputPath))

  if (!step.config?.generatesAssetsManifest) return

  if (!Array.isArray(config.extension_points)) return

  const pointsWithManifest = config.extension_points.filter(
    (ep): ep is ExtensionPointWithBuildManifest => typeof ep === 'object' && ep.build_manifest,
  )

  const entries = extractBuiltAssetEntries(pointsWithManifest)
  if (Object.keys(entries).length > 0) {
    await createOrUpdateManifestFile(context, entries)
  }
}

/**
 * Extracts built asset filepaths from `build_manifest` on each extension point,
 * grouped by target. Returns a map of target → `{assetName: filepath}`.
 */
function extractBuiltAssetEntries(extensionPoints: {target: string; build_manifest: BuildManifest}[]): {
  [target: string]: {[assetName: string]: string}
} {
  const entries: {[target: string]: {[assetName: string]: string}} = {}
  for (const {target, build_manifest: buildManifest} of extensionPoints) {
    if (!buildManifest?.assets) continue
    const assets: {[name: string]: string} = {}
    for (const [name, asset] of Object.entries(buildManifest.assets)) {
      if (asset?.filepath) assets[name] = asset.filepath
    }
    if (Object.keys(assets).length > 0) entries[target] = assets
  }
  return entries
}
