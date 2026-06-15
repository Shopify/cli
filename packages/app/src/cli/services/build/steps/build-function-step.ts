import {buildFunctionExtension} from '../extension.js'
import type {LifecycleStep, BuildContext} from '../client-steps.js'

/**
 * Executes a build_function build step.
 *
 * Compiles the function extension (JavaScript or other language) to WASM,
 * applying wasm-opt and trampoline as configured.
 */
export async function executeBuildFunctionStep(_step: LifecycleStep, context: BuildContext): Promise<void> {
  return buildFunctionExtension(context.extension, context.options)
}
