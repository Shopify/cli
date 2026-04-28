import {buildUIExtension} from '../extension.js'
import {copyFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath, resolvePath} from '@shopify/cli-kit/node/path'
import type {BundleUIStep, BuildContext} from '../client-steps.js'

/**
 * Executes a bundle_ui build step.
 *
 * Bundles the UI extension using esbuild into the extension's local directory
 * and copies the output to the bundle. Manifest emission lives in the separate
 * `generate_ui_assets_manifest` step so it only runs in lifecycles that need it.
 */
export async function executeBundleUIStep(step: BundleUIStep, context: BuildContext): Promise<void> {
  context.options.buildDirectory = step.config?.bundleFolder ?? undefined
  const localOutputPath = await buildUIExtension(context.extension, context.options)
  const localOutputDir = dirname(localOutputPath)
  const bundleOutputDir = step.config?.bundleFolder
    ? joinPath(dirname(context.extension.outputPath), step.config.bundleFolder)
    : dirname(context.extension.outputPath)
  if (resolvePath(localOutputDir) !== resolvePath(bundleOutputDir)) {
    await copyFile(localOutputDir, bundleOutputDir)
  }
}
