import {executeIncludeAssetsStep} from './include-assets-step.js'
import {executeBuildThemeStep} from './build-theme-step.js'
import {executeBundleThemeStep} from './bundle-theme-step.js'
import {executeBundleUIStep} from './bundle-ui-step.js'
import {executeGenerateUIAssetsManifestStep} from './generate-ui-assets-manifest-step.js'
import {executeBuildFunctionStep} from './build-function-step.js'
import {executeCreateTaxStubStep} from './create-tax-stub-step.js'
import type {LifecycleStep, BuildContext} from '../client-steps.js'

/**
 * Routes step execution to the appropriate handler based on step type.
 * This implements the Command Pattern router, dispatching to type-specific executors.
 *
 * @param step - The build step configuration
 * @param context - The build context
 * @returns The output from the step execution
 * @throws Error if the step type is not implemented or unknown
 */
export async function executeStepByType(step: LifecycleStep, context: BuildContext): Promise<unknown> {
  switch (step.type) {
    case 'include_assets':
      return executeIncludeAssetsStep(step, context)

    case 'build_theme':
      return executeBuildThemeStep(step, context)

    case 'bundle_theme':
      return executeBundleThemeStep(step, context)

    case 'bundle_ui':
      return executeBundleUIStep(step, context)

    case 'generate_ui_assets_manifest':
      return executeGenerateUIAssetsManifestStep(step, context)

    case 'build_function':
      return executeBuildFunctionStep(step, context)

    case 'create_tax_stub':
      return executeCreateTaxStubStep(step, context)
    default:
      throw new Error(`Unknown build step type: ${(step as {type: string}).type}`)
  }
}
