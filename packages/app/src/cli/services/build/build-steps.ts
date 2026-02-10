import type {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import type {ExtensionBuildOptions} from './extension.js'
import {executeStepByType} from './steps/index.js'
import {AbortSignal} from '@shopify/cli-kit/node/abort'

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
  readonly type: 'copy_files' | 'esbuild' | 'validate' | 'transform' | 'custom'

  /** Step-specific configuration */
  readonly config: Record<string, unknown>

  /**
   * Optional function to determine if step should be skipped
   * @param context - Build context
   * @returns true if step should be skipped
   */
  skip?(context: BuildContext): boolean

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

  /** Abort signal for cancellation */
  readonly signal?: AbortSignal

  /** Custom data that steps can write to (extensible) */
  [key: string]: unknown
}

/**
 * Result of a step execution
 */
export interface StepResult {
  readonly stepId: string
  readonly displayName: string
  readonly success: boolean
  readonly duration: number
  readonly output?: unknown
  readonly error?: Error
}

/**
 * Reference to a configuration value.
 * Used to dynamically resolve values from the extension's configuration at build time.
 */
export interface ConfigReference {
  /** Path to the config value (e.g., 'static_root' or 'nested.field') */
  configPath: string
  /** Whether this reference is optional (if true, undefined values are acceptable) */
  optional?: boolean
}

/**
 * Reference to an environment variable.
 * Used to dynamically resolve values from environment variables at build time.
 */
export interface EnvReference {
  /** Name of the environment variable */
  envVar: string
  /** Whether this reference is optional (if true, undefined values are acceptable) */
  optional?: boolean
}

/**
 * A value that can be either:
 * - A literal value (T)
 * - A reference to a config field ({configPath: string})
 * - A reference to an environment variable ({envVar: string})
 *
 * This allows build step configurations to be static (serializable to JSON)
 * while still supporting dynamic values resolved at build time.
 *
 * Example:
 * ```typescript
 * // Literal value
 * source: 'public'
 *
 * // Reference to config
 * source: {configPath: 'static_root'}
 *
 * // Reference to env var
 * source: {envVar: 'BUILD_DIR'}
 * ```
 */
export type ConfigurableValue<T> = T | ConfigReference | EnvReference

/**
 * Checks if a ConfigurableValue is a reference (ConfigReference or EnvReference).
 *
 * @param value - The value to check
 * @returns true if the value is a reference object
 */
export function isReference(value: unknown): value is ConfigReference | EnvReference {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('configPath' in value || 'envVar' in value)
  )
}

/**
 * Checks if a reference is marked as optional.
 *
 * @param value - The reference to check
 * @returns true if the reference has optional: true
 */
export function isOptionalReference(value: unknown): boolean {
  if (!isReference(value)) {
    return false
  }
  return value.optional === true
}

/**
 * Resolves a ConfigurableValue to its actual value.
 * If the value is a reference (configPath or envVar), it will be resolved from the context.
 * Otherwise, the literal value is returned as-is.
 *
 * @param value - The configurable value to resolve
 * @param context - The build context containing extension config and options
 * @returns The resolved value, or undefined if the reference cannot be resolved
 */
export function resolveConfigurableValue<T>(
  value: ConfigurableValue<T> | undefined,
  context: BuildContext,
): T | undefined {
  if (!value) {
    return undefined
  }

  // Check if it's a config reference
  if (typeof value === 'object' && value !== null && 'configPath' in value) {
    const configRef = value as ConfigReference
    return getNestedValue(context.extension.configuration, configRef.configPath) as T | undefined
  }

  // Check if it's an env var reference
  if (typeof value === 'object' && value !== null && 'envVar' in value) {
    const envRef = value as EnvReference
    return process.env[envRef.envVar] as T | undefined
  }

  // It's a literal value
  return value as T
}

/**
 * Helper function to get a nested value from an object using a dot-separated path.
 * Example: getNestedValue({a: {b: {c: 'value'}}}, 'a.b.c') => 'value'
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }
    if (typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }

  return current
}

/**
 * BuildStepsConfig defines the pipeline configuration.
 * Uses Builder Pattern principles for construction.
 */
export interface BuildStepsConfig {
  /** Array of steps to execute in order */
  readonly steps: ReadonlyArray<BuildStep>

  /** Whether to run steps in parallel (default: false) */
  readonly parallel?: boolean

  /** Whether to stop on first error (default: true) */
  readonly stopOnError?: boolean
}

/**
 * Executes a build steps pipeline for an extension.
 *
 * @param extension - The extension instance to build
 * @param stepsConfig - Configuration defining the build steps
 * @param options - Build options (stdout, stderr, etc.)
 */
export async function executeBuildSteps(
  extension: ExtensionInstance,
  stepsConfig: BuildStepsConfig,
  options: ExtensionBuildOptions,
): Promise<void> {
  const context: BuildContext = {
    extension,
    options,
    stepResults: new Map(),
    signal: options.signal,
  }

  const {steps, parallel = false, stopOnError = true} = stepsConfig

  if (parallel) {
    await executeStepsInParallel(steps, context, stopOnError)
  } else {
    await executeStepsSequentially(steps, context, stopOnError)
  }
}

/**
 * Executes steps sequentially, passing context through each step.
 */
async function executeStepsSequentially(
  steps: ReadonlyArray<BuildStep>,
  context: BuildContext,
  stopOnError: boolean,
): Promise<void> {
  for (const step of steps) {
    const result = await executeStep(step, context)
    context.stepResults.set(step.id, result)

    // Only stop on error if:
    // 1. The step failed (result.success === false)
    // 2. Global stopOnError is true
    // 3. The step doesn't have continueOnError flag
    if (!result.success && stopOnError && !step.continueOnError) {
      throw new Error(`Build step "${step.displayName}" failed: ${result.error?.message}`)
    }
  }
}

/**
 * Executes steps in parallel (for independent steps).
 */
async function executeStepsInParallel(
  steps: ReadonlyArray<BuildStep>,
  context: BuildContext,
  stopOnError: boolean,
): Promise<void> {
  const results = await Promise.allSettled(steps.map((step) => executeStep(step, context)))

  // Store all results
  results.forEach((result, index) => {
    const step = steps[index]!
    if (result.status === 'fulfilled') {
      context.stepResults.set(step.id, result.value)
    } else {
      context.stepResults.set(step.id, {
        stepId: step.id,
        displayName: step.displayName,
        success: false,
        duration: 0,
        error: result.reason as Error,
      })
    }
  })

  const failures = results.filter((r) => r.status === 'rejected')
  if (failures.length > 0 && stopOnError) {
    throw new Error(`${failures.length} build step(s) failed`)
  }
}

/**
 * Executes a single build step with error handling and skip logic.
 */
async function executeStep(step: BuildStep, context: BuildContext): Promise<StepResult> {
  const startTime = Date.now()

  try {
    // Check if step should be skipped
    if (step.skip?.(context)) {
      context.options.stdout.write(`Skipping step: ${step.displayName}\n`)
      return {
        stepId: step.id,
        displayName: step.displayName,
        success: true,
        duration: Date.now() - startTime,
        output: 'skipped',
      }
    }

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
      context.options.stderr.write(
        `Warning: Step "${step.displayName}" failed but continuing: ${stepError.message}\n`,
      )
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
