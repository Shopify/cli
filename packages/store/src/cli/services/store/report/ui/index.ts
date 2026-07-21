import {renderReportSpec} from './render.js'
import {generateReportSpecText, parseAndValidateReportSpec} from './spec.js'
import {renderStoreReportResult} from '../output.js'
import type {GenerateReportSpecInput} from './spec.js'
import type {StoreReportResult} from '../types.js'

export interface RenderStoreReportUiInput {
  result: StoreReportResult
  proxyBaseUrl: string
  proxyToken: string
  model: string
}

export interface StoreReportUiDependencies {
  generateSpecText: typeof generateReportSpecText
  renderSpec: typeof renderReportSpec
  renderFallback: typeof renderStoreReportResult
}

const defaultStoreReportUiDependencies: StoreReportUiDependencies = {
  generateSpecText: generateReportSpecText,
  renderSpec: renderReportSpec,
  renderFallback: renderStoreReportResult,
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
      const modelOutput = await deps.generateSpecText(generationInput)
      const validation = parseAndValidateReportSpec(modelOutput)
      if (!validation.success) return false

      await deps.renderSpec(validation.spec)
      return true
    })
    .catch(() => false)

  if (!renderedVisualization) deps.renderFallback(input.result, 'text')
}
