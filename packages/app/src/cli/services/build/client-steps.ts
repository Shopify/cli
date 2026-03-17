import {executeStepByType} from './steps/index.js'
import type {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import type {ExtensionBuildOptions} from './extension.js'

/**
 * ClientStep represents a single step in the client-side build pipeline.
 * Pure configuration object — execution logic is separate (router pattern).
 */
export interface ClientStep {
  /** Unique identifier, used as the key in the stepResults map */
  readonly id: string

  /** Human-readable name for logging */
  readonly name: string

  /** Step type (determines which executor handles it) */
  readonly type:
    | 'include_assets'
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

  /** Whether to continue on error (default: false) */
  readonly continueOnError?: boolean
}

/**
 * A group of steps scoped to a specific lifecycle phase.
 * Allows executing only the steps relevant to a given lifecycle (e.g. 'deploy').
 */
interface ClientLifecycleGroup {
  readonly lifecycle: 'deploy'
  readonly steps: ReadonlyArray<ClientStep>
}

/**
 * The full client steps configuration for an extension.
 * Replaces the old buildConfig contract.
 */
export type ClientSteps = ReadonlyArray<ClientLifecycleGroup>

/**
 * Context passed through the step pipeline.
 * Each step can read from and write to the context.
 */
export interface BuildContext {
  readonly extension: ExtensionInstance
  readonly options: ExtensionBuildOptions
  readonly stepResults: Map<string, StepResult>
  [key: string]: unknown
}

interface StepResult {
  readonly id: string
  readonly success: boolean
  readonly duration: number
  readonly output?: unknown
  readonly error?: Error
}

/**
 * Executes a single client step with error handling.
 */
export async function executeStep(step: ClientStep, context: BuildContext): Promise<StepResult> {
  const startTime = Date.now()

  try {
    context.options.stdout.write(`Executing step: ${step.name}\n`)
    const output = await executeStepByType(step, context)

    return {
      id: step.id,
      success: true,
      duration: Date.now() - startTime,
      output,
    }
  } catch (error) {
    const stepError = error as Error

    if (step.continueOnError) {
      context.options.stderr.write(`Warning: Step "${step.name}" failed but continuing: ${stepError.message}\n`)
      return {
        id: step.id,
        success: false,
        duration: Date.now() - startTime,
        error: stepError,
      }
    }

    throw new Error(`Build step "${step.name}" failed: ${stepError.message}`)
  }
}
