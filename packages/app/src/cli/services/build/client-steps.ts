import {executeStepByType} from './steps/index.js'
import type {IncludeAssetsConfig} from './steps/include-assets-step.js'
import type {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import type {ExtensionBuildOptions} from './extension.js'

/** Common fields shared by all lifecycle steps. */
interface BaseStep {
  /** Unique identifier, used as the key in the stepResults map */
  readonly id: string

  /** Human-readable name for logging */
  readonly name: string

  /** Whether to continue on error (default: false) */
  readonly continueOnError?: boolean
}

/** Step with typed config specific to include_assets. */
interface IncludeAssetsStep extends BaseStep {
  readonly type: 'include_assets'
  readonly config: IncludeAssetsConfig
}

/** Steps that don't require any config yet. */
interface NoConfigStep extends BaseStep {
  readonly type:
    | 'build_theme'
    | 'bundle_theme'
    | 'bundle_ui'
    | 'copy_static_assets'
    | 'build_function'
    | 'create_tax_stub'
  readonly config?: Record<string, never>
}

/**
 * LifecycleStep represents a single step in the client-side build pipeline.
 * Pure configuration object — execution logic is separate (router pattern).
 *
 * This is a discriminated union on `type`: each step type carries its own
 * typed `config`, so TypeScript catches config typos at compile time.
 */
export type LifecycleStep = IncludeAssetsStep | NoConfigStep

/**
 * A group of steps scoped to a specific lifecycle phase.
 * Allows executing only the steps relevant to a given lifecycle (e.g. 'deploy').
 */
interface ClientLifecycleGroup {
  readonly lifecycle: 'deploy'
  readonly steps: ReadonlyArray<LifecycleStep>
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
}

type StepResult = {
  readonly id: string
  readonly duration: number
} & (
  | {
      readonly success: false
      readonly error: Error
    }
  | {
      readonly success: true
      readonly output: never
    }
)

/**
 * Executes a single client step with error handling.
 */
export async function executeStep(step: LifecycleStep, context: BuildContext): Promise<StepResult> {
  const startTime = Date.now()

  try {
    const output = await executeStepByType(step, context)

    return {
      id: step.id,
      success: true,
      duration: Date.now() - startTime,
      output: output as never,
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
