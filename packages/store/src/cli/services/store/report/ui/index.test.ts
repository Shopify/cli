import {renderStoreReportUi, type StoreReportUiDependencies} from './index.js'
import {describe, expect, test, vi} from 'vitest'
import type {StoreReportResult} from '../types.js'

const reportResult: StoreReportResult = {
  store: 'shop.myshopify.com',
  apiVersion: '2026-04',
  question: 'What were my sales?',
  api: 'shopifyql',
  query: 'FROM sales SHOW total_sales',
  rationale: 'A sales total.',
  result: {rows: [{total_sales: 10}]},
}

const input = {
  result: reportResult,
  proxyBaseUrl: 'https://proxy.test/v1',
  proxyToken: 'synthetic-proxy-token',
  model: 'test-model',
}

function createDependencies(): StoreReportUiDependencies {
  return {
    generateSpecText: vi.fn().mockResolvedValue(
      JSON.stringify({
        root: 'heading',
        elements: {heading: {type: 'Heading', props: {text: 'Sales'}}},
      }),
    ),
    renderSpec: vi.fn(),
    renderFallback: vi.fn(),
  }
}

describe('renderStoreReportUi', () => {
  test('generates, validates, and renders a static spec', async () => {
    const dependencies = createDependencies()

    await renderStoreReportUi(input, dependencies)

    expect(dependencies.generateSpecText).toHaveBeenCalledWith({
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

  test('falls back to the established text renderer when validation fails', async () => {
    const dependencies = createDependencies()
    vi.mocked(dependencies.generateSpecText).mockResolvedValue('{"root":"missing","elements":{}}')

    await renderStoreReportUi(input, dependencies)

    expect(dependencies.renderSpec).not.toHaveBeenCalled()
    expect(dependencies.renderFallback).toHaveBeenCalledWith(reportResult, 'text')
  })

  test('falls back when generation throws', async () => {
    const dependencies = createDependencies()
    vi.mocked(dependencies.generateSpecText).mockRejectedValue(new Error('model unavailable'))

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
})
