import {renderStoreReportUi, type StoreReportUiDependencies} from './index.js'
import {describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import type {StoreReportResult} from '../types.js'

const reportResult: StoreReportResult = {
  store: 'shop.myshopify.com',
  apiVersion: '2026-04',
  question: 'What were my sales?',
  rationale: 'A sales total.',
  queries: [{api: 'shopifyql', query: 'FROM sales SHOW total_sales', result: {rows: [{total_sales: 10}]}}],
}

const input = {
  result: reportResult,
  proxyBaseUrl: 'https://proxy.test/v1',
  proxyToken: 'synthetic-proxy-token',
  model: 'test-model',
}

const validSpec = {
  root: 'heading',
  elements: {heading: {type: 'Heading', props: {text: 'Sales'}}},
}

function createDependencies(): StoreReportUiDependencies {
  return {
    generateSpec: vi.fn().mockResolvedValue({success: true, spec: validSpec, attempts: 1}),
    renderSpec: vi.fn(),
    renderFallback: vi.fn(),
  }
}

describe('renderStoreReportUi', () => {
  test('generates, validates, and renders a static spec', async () => {
    const dependencies = createDependencies()

    await renderStoreReportUi(input, dependencies)

    expect(dependencies.generateSpec).toHaveBeenCalledWith({
      report: reportResult,
      proxyBaseUrl: 'https://proxy.test/v1',
      proxyToken: 'synthetic-proxy-token',
      model: 'test-model',
    })
    expect(dependencies.renderSpec).toHaveBeenCalledWith(
      expect.objectContaining({root: 'heading', elements: expect.any(Object)}),
    )
    expect(dependencies.renderFallback).not.toHaveBeenCalled()
  })

  test('falls back to the established text renderer when generation exhausts every attempt', async () => {
    const dependencies = createDependencies()
    vi.mocked(dependencies.generateSpec).mockResolvedValue({
      success: false,
      failures: [{reason: 'Root element "missing" does not exist.', output: '{"root":"missing","elements":{}}'}],
    })

    await renderStoreReportUi(input, dependencies)

    expect(dependencies.renderSpec).not.toHaveBeenCalled()
    expect(dependencies.renderFallback).toHaveBeenCalledWith(reportResult, 'text')
  })

  test('prints a visible failure summary and debugs the raw output of every attempt', async () => {
    mockAndCaptureOutput().clear()
    const output = mockAndCaptureOutput()
    const dependencies = createDependencies()
    vi.mocked(dependencies.generateSpec).mockResolvedValue({
      success: false,
      failures: [
        {reason: 'Root element "missing" does not exist.', output: '{"root":"missing","elements":{}}'},
        {reason: 'The model response contained malformed JSON.', output: '{"root":]}'},
      ],
    })

    await renderStoreReportUi(input, dependencies)

    expect(output.warn()).toContain('Could not generate a valid report dashboard after 2 attempt(s)')
    expect(output.warn()).toContain('Root element "missing" does not exist.')
    expect(output.warn()).toContain('The model response contained malformed JSON.')
    expect(output.debug()).toContain('{"root":"missing","elements":{}}')
    expect(output.debug()).toContain('{"root":]}')
  })

  test('falls back when generation throws', async () => {
    const dependencies = createDependencies()
    vi.mocked(dependencies.generateSpec).mockRejectedValue(new Error('model unavailable'))

    await renderStoreReportUi(input, dependencies)

    expect(dependencies.renderSpec).not.toHaveBeenCalled()
    expect(dependencies.renderFallback).toHaveBeenCalledWith(reportResult, 'text')
  })

  test('falls back when rendering throws', async () => {
    const dependencies = createDependencies()
    vi.mocked(dependencies.renderSpec).mockRejectedValue(new Error('render failed'))

    await renderStoreReportUi(input, dependencies)

    expect(dependencies.renderFallback).toHaveBeenCalledWith(reportResult, 'text')
  })

  test('debugs the thrown error reason when rendering throws', async () => {
    mockAndCaptureOutput().clear()
    const output = mockAndCaptureOutput()
    const dependencies = createDependencies()
    vi.mocked(dependencies.renderSpec).mockRejectedValue(new Error('render failed'))

    await renderStoreReportUi(input, dependencies)

    expect(output.debug()).toContain('Report visualization failed: Error: render failed')
  })
})
