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
export async function executeStepByType(step: LifecycleStep, _context: BuildContext): Promise<unknown> {
  switch (step.type) {
    // Future step types (not implemented yet):
    case 'include_assets':
    case 'build_theme':
    case 'bundle_theme':
    case 'bundle_ui':
    case 'copy_static_assets':
    case 'build_function':
    case 'create_tax_stub':
    case 'esbuild':
    case 'validate':
    case 'transform':
    case 'custom':
      throw new Error(`Build step type "${step.type}" is not yet implemented.`)

    default:
      throw new Error(`Unknown build step type: ${(step as {type: string}).type}`)
  }
}
