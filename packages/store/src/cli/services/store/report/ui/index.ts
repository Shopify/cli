import {renderReportSpec} from './render.js'
import {generateValidatedReportSpec} from './spec.js'
import {renderStoreReportResult} from '../output.js'
import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'
import type {GenerateReportSpecInput, SpecGenerationFailure} from './spec.js'
import type {StoreReportResult} from '../types.js'

const MODEL_OUTPUT_SNIPPET_LENGTH = 2000

function describeThrownError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? error.message
  return String(error)
}

export interface RenderStoreReportUiInput {
  result: StoreReportResult
  proxyBaseUrl: string
  proxyToken: string
  model: string
}

export interface StoreReportUiDependencies {
  generateSpec: typeof generateValidatedReportSpec
  renderSpec: typeof renderReportSpec
  renderFallback: typeof renderStoreReportResult
}

const defaultStoreReportUiDependencies: StoreReportUiDependencies = {
  generateSpec: generateValidatedReportSpec,
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

/** Generates and renders a terminal visualization, falling back to the established text output. */
export async function renderStoreReportUi(
  input: RenderStoreReportUiInput,
  dependencies: Partial<StoreReportUiDependencies> = {},
): Promise<void> {
  const deps = {...defaultStoreReportUiDependencies, ...dependencies}
  const generationInput: GenerateReportSpecInput = {
    report: input.result,
    proxyBaseUrl: input.proxyBaseUrl,
    proxyToken: input.proxyToken,
    model: input.model,
  }

  // Generation, serialization, parsing, validation, and Ink rendering can all fail independently.
  // A rejected attempt becomes the legacy text output; fallback errors still propagate normally.
  const renderedVisualization = await Promise.resolve()
    .then(async () => {
      const result = await deps.generateSpec(generationInput)
      if (!result.success) {
        reportGenerationFailures(result.failures)
        return false
      }

      await deps.renderSpec(result.spec)
      return true
    })
    .catch((error: unknown) => {
      outputDebug(`Report visualization failed: ${describeThrownError(error)}`)
      return false
    })

  if (!renderedVisualization) deps.renderFallback(input.result, 'text')
}
