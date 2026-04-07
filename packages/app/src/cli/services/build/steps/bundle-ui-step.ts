import {mergeManifestEntries} from './include-assets/generate-manifest.js'
import {buildUIExtension} from '../extension.js'
import {BuildManifest} from '../../../models/extensions/specifications/ui_extension.js'
import type {LifecycleStep, BuildContext} from '../client-steps.js'

interface ExtensionPointWithBuildManifest {
  target: string
  build_manifest: BuildManifest
}

/**
 * Executes a bundle_ui build step.
 *
 * Bundles the UI extension using esbuild, writing output to extension.outputPath.
 * When `generatesAssetsManifest` is true, writes built asset entries (from
 * build_manifest) into manifest.json so downstream steps can merge on top.
 */
export async function executeBundleUIStep(step: LifecycleStep, context: BuildContext): Promise<void> {
  await buildUIExtension(context.extension, context.options)

  if (!('generatesAssetsManifest' in step) || !step.generatesAssetsManifest) return

  const config = context.extension.configuration as Record<string, unknown>
  const extensionPoints = config.extension_points
  if (!Array.isArray(extensionPoints) || !extensionPoints.every((ep) => typeof ep === 'object' && ep?.build_manifest))
    return

  const entries = extractBuiltAssetEntries(extensionPoints as ExtensionPointWithBuildManifest[])
  if (Object.keys(entries).length > 0) {
    await mergeManifestEntries(context, entries)
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
