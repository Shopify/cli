import {buildUIExtension} from '../extension.js'
import type {ClientStep, BuildContext} from '../client-steps.js'

/**
 * Executes a bundle_ui build step.
 *
 * Bundles the UI extension using esbuild, writing output to extension.outputPath.
 */
export async function executeBundleUIStep(_step: ClientStep, context: BuildContext): Promise<void> {
  return buildUIExtension(context.extension, context.options)
}
