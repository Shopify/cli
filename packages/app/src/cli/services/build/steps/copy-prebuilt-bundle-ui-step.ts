import {createOrUpdateManifestFile} from './include-assets/generate-manifest.js'
import {copyFile, fileExists} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath, resolvePath} from '@shopify/cli-kit/node/path'
import {outputDebug} from '@shopify/cli-kit/node/output'
import type {BundleUIStep, BuildContext} from '../client-steps.js'
import type {BuildManifest} from '../../../models/extensions/specifications/ui_extension.js'

interface ExtensionPointWithBuildManifest {
  target: string
  build_manifest: BuildManifest
}

export async function copyPrebuiltBundleUIStep(
  step: BundleUIStep,
  context: BuildContext,
  defaultOutputPath: string,
): Promise<void> {
  const localOutputDir = step.config?.bundleFolder
    ? joinPath(dirname(defaultOutputPath), step.config.bundleFolder)
    : dirname(defaultOutputPath)
  const bundleOutputDir = step.config?.bundleFolder
    ? joinPath(dirname(context.extension.outputPath), step.config.bundleFolder)
    : dirname(context.extension.outputPath)

  if (resolvePath(localOutputDir) !== resolvePath(bundleOutputDir)) {
    if (await fileExists(localOutputDir)) {
      await copyFile(localOutputDir, bundleOutputDir)
    } else {
      outputDebug(`No pre-built UI extension output found at ${localOutputDir}\n`, context.options.stdout)
    }
  }

  if (!step.config?.generatesAssetsManifest) return

  const config = context.extension.configuration
  if (!Array.isArray(config.extension_points)) return

  const pointsWithManifest = config.extension_points.filter(
    (ep): ep is ExtensionPointWithBuildManifest => typeof ep === 'object' && ep !== null && 'build_manifest' in ep,
  )

  const entries = extractBuiltAssetEntries(pointsWithManifest, step.config?.bundleFolder)
  if (Object.keys(entries).length > 0) {
    await createOrUpdateManifestFile(context, entries)
  }
}

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
