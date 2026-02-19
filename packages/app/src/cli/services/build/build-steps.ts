import {executeStepByType} from './steps/index.js'
import type {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import type {ExtensionBuildOptions} from './extension.js'

/**
 * BuildStep represents a single build command configuration.
 * Inspired by the existing Task<TContext> pattern in:
 * /packages/cli-kit/src/private/node/ui/components/Tasks.tsx
 *
 * Key differences from Task<TContext>:
 * - Not coupled to UI rendering
 * - Pure configuration object (execution logic is separate)
 * - Router pattern dispatches to type-specific executors
 */
export interface BuildStep {
  /** Unique identifier for this step (e.g., 'copy_files', 'build') */
  readonly id: string

  /** Display name for logging */
  readonly displayName: string

  /** Optional description */
  readonly description?: string

  /** Step type (determines which executor handles it) */
  readonly type:
    | 'copy_files'
    | 'build_theme'
    | 'bundle_theme'
    | 'bundle_ui'
    | 'copy_static_assets'
    | 'build_function'
    | 'create_tax_stub'
    | 'esbuild'
    | 'validate'
    | 'transform'
    | 'custom'

  /** Step-specific configuration */
  readonly config: {[key: string]: unknown}

  /**
   * Whether to continue on error (default: false)
   */
  readonly continueOnError?: boolean
}

/**
 * BuildContext is passed through the pipeline (similar to Task<TContext>).
 * Each step can read from and write to the context.
 *
 * Key design: Immutable configuration, mutable context
 */
export interface BuildContext {
  /** The extension being built */
  readonly extension: ExtensionInstance

  /** Build options (stdout, stderr, etc.) */
  readonly options: ExtensionBuildOptions

  /** Results from previous steps (for step dependencies) */
  readonly stepResults: Map<string, StepResult>

  /** Custom data that steps can write to (extensible) */
  [key: string]: unknown
}

/**
 * Result of a step execution
 */
interface StepResult {
  readonly stepId: string
  readonly displayName: string
  readonly success: boolean
  readonly duration: number
  readonly output?: unknown
  readonly error?: Error
}

/**
 * Executes a single build step with error handling and skip logic.
 */
export async function executeStep(step: BuildStep, context: BuildContext): Promise<StepResult> {
  const startTime = Date.now()

  try {
    // Execute the step using type-specific executor
    context.options.stdout.write(`Executing step: ${step.displayName}\n`)
    const output = await executeStepByType(step, context)

    return {
      stepId: step.id,
      displayName: step.displayName,
      success: true,
      duration: Date.now() - startTime,
      output,
    }
  } catch (error) {
    const stepError = error as Error

    if (step.continueOnError) {
      context.options.stderr.write(`Warning: Step "${step.displayName}" failed but continuing: ${stepError.message}\n`)
      return {
        stepId: step.id,
        displayName: step.displayName,
        success: false,
        duration: Date.now() - startTime,
        error: stepError,
      }
    }

    throw new Error(`Build step "${step.displayName}" failed: ${stepError.message}`)
  }
}
