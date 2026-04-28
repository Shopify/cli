import {createOrUpdateManifestFile} from './include-assets/generate-manifest.js'
import {BuildManifest} from '../../../models/extensions/specifications/ui_extension.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {GenerateUIAssetsManifestStep, BuildContext} from '../client-steps.js'

interface ExtensionPointWithBuildManifest {
  target: string
  build_manifest: BuildManifest
}

/**
 * Executes a generate_ui_assets_manifest build step.
 *
 * Reads `extension_points[].build_manifest.assets` from the extension
 * configuration and writes the resulting target → asset map into manifest.json
 * in the bundle output directory. Intended to run after a `bundle_ui` step in
 * lifecycles that need a deployable manifest (deploy, dev) and to be omitted
 * from the build-only lifecycle.
 */
export async function executeGenerateUIAssetsManifestStep(
  step: GenerateUIAssetsManifestStep,
  context: BuildContext,
): Promise<void> {
  const config = context.extension.configuration
  if (!Array.isArray(config.extension_points)) return

  const pointsWithManifest = config.extension_points.filter(
    (ep): ep is ExtensionPointWithBuildManifest => typeof ep === 'object' && ep.build_manifest,
  )

  const entries = extractBuiltAssetEntries(pointsWithManifest, step.config?.bundleFolder)
  if (Object.keys(entries).length > 0) {
    await createOrUpdateManifestFile(context, entries)
  }
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
