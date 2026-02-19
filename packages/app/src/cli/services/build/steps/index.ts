import {executeCopyFilesStep} from './copy-files-step.js'
import {executeBuildThemeStep} from './build-theme-step.js'
import {executeBundleThemeStep} from './bundle-theme-step.js'
import {executeBundleUIStep} from './bundle-ui-step.js'
import {executeCopyStaticAssetsStep} from './copy-static-assets-step.js'
import {executeBuildFunctionStep} from './build-function-step.js'
import {executeCreateTaxStubStep} from './create-tax-stub-step.js'
import type {BuildStep, BuildContext} from '../build-steps.js'

/**
 * Routes step execution to the appropriate handler based on step type.
 * This implements the Command Pattern router, dispatching to type-specific executors.
 *
 * @param step - The build step configuration
 * @param context - The build context
 * @returns The output from the step execution
 * @throws Error if the step type is not implemented or unknown
 */
export async function executeStepByType(step: BuildStep, context: BuildContext): Promise<unknown> {
  switch (step.type) {
    case 'copy_files':
      return executeCopyFilesStep(step, context)

    case 'build_theme':
      return executeBuildThemeStep(step, context)

    case 'bundle_theme':
      return executeBundleThemeStep(step, context)

    case 'bundle_ui':
      return executeBundleUIStep(step, context)

    case 'copy_static_assets':
      return executeCopyStaticAssetsStep(step, context)

    case 'build_function':
      return executeBuildFunctionStep(step, context)

    case 'create_tax_stub':
      return executeCreateTaxStubStep(step, context)

    // Future step types (not implemented yet):
    case 'esbuild':
    case 'validate':
    case 'transform':
    case 'custom':
      throw new Error(`Build step type "${step.type}" is not yet implemented.`)

    default:
      throw new Error(`Unknown build step type: ${(step as {type: string}).type}`)
  }
}
