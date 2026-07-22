import {renderReportSpec} from './render.js'
import {generateValidatedReportSpec} from './spec.js'
import {renderStoreReportResult} from '../output.js'
import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'
import type {GenerateReportSpecInput, SpecGenerationFailure} from './spec.js'
import type {StoreReportResult} from '../types.js'
import type {Spec} from '@json-render/core'

const MODEL_OUTPUT_SNIPPET_LENGTH = 2000

function describeThrownError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? error.message
  return String(error)
}

export type GenerateStoreReportSpecOutcome = {spec: Spec} | {fallback: true; failures?: SpecGenerationFailure[]}

interface GenerateStoreReportSpecDependencies {
  generateSpec: typeof generateValidatedReportSpec
}

const defaultGenerateStoreReportSpecDependencies: GenerateStoreReportSpecDependencies = {
  generateSpec: generateValidatedReportSpec,
}

/**
 * Runs the visualization model, inside the progress bar. Never throws: an exhausted validation
 * budget returns the failures for `presentStoreReport` to report, and a thrown error (e.g. a network
 * failure) is debug-logged and turned into a plain fallback so the bar can close normally either way.
 */
export async function generateStoreReportSpec(
  input: GenerateReportSpecInput,
  dependencies: Partial<GenerateStoreReportSpecDependencies> = {},
): Promise<GenerateStoreReportSpecOutcome> {
  const deps = {...defaultGenerateStoreReportSpecDependencies, ...dependencies}

  return deps.generateSpec(input).then(
    (result): GenerateStoreReportSpecOutcome =>
      result.success ? {spec: result.spec} : {fallback: true, failures: result.failures},
    (error: unknown): GenerateStoreReportSpecOutcome => {
      outputDebug(`Report visualization failed: ${describeThrownError(error)}`)
      return {fallback: true}
    },
  )
}

export interface PresentStoreReportDependencies {
  renderSpec: typeof renderReportSpec
  renderFallback: typeof renderStoreReportResult
}

const defaultPresentStoreReportDependencies: PresentStoreReportDependencies = {
  renderSpec: renderReportSpec,
  renderFallback: renderStoreReportResult,
}

/** Prints an always-visible failure summary, then routes each attempt's raw output to the debug log. */
function reportGenerationFailures(failures: SpecGenerationFailure[]): void {
  const attemptLines = failures.map((failure, index) => `  Attempt ${index + 1}: ${failure.reason}`)
  outputWarn(
    [
      `Could not generate a valid report dashboard after ${failures.length} attempt(s); showing the text report instead.`,
      ...attemptLines,
    ].join('\n'),
  )

  failures.forEach((failure, index) => {
    outputDebug(`Attempt ${index + 1} model output: ${failure.output.slice(0, MODEL_OUTPUT_SNIPPET_LENGTH)}`)
  })
}

/**
 * Presents the outcome of `generateStoreReportSpec`, after the progress bar has closed: renders the
 * generated spec if there is one, falling back to the established text report if rendering throws or
 * generation didn't produce a spec (printing the failure summary first, when there is one).
 */
export async function presentStoreReport(
  report: StoreReportResult,
  generation: GenerateStoreReportSpecOutcome,
  dependencies: Partial<PresentStoreReportDependencies> = {},
): Promise<void> {
  const deps = {...defaultPresentStoreReportDependencies, ...dependencies}

  if ('spec' in generation) {
    const rendered = await Promise.resolve(deps.renderSpec(generation.spec)).then(
      () => true,
      (error: unknown) => {
        outputDebug(`Report visualization failed: ${describeThrownError(error)}`)
        return false
      },
    )
    if (rendered) return
  } else if (generation.failures) {
    reportGenerationFailures(generation.failures)
  }

  deps.renderFallback(report, 'text')
}
