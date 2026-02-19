import type {BuildStep, BuildContext} from '../build-steps.js'

/**
 * Executes a copy_static_assets build step.
 *
 * Copies static assets defined in the extension's build_manifest to the output directory.
 * This is a no-op for extensions that do not define static assets.
 */
export async function executeCopyStaticAssetsStep(_step: BuildStep, context: BuildContext): Promise<void> {
  return context.extension.copyStaticAssets()
}
