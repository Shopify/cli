import {generateStoreReportSpec, presentStoreReport} from './index.js'
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

const generationInput = {
  report: reportResult,
  proxyBaseUrl: 'https://proxy.test/v1',
  proxyToken: 'synthetic-proxy-token',
  model: 'test-model',
}

const validSpec = {
  root: 'heading',
  elements: {heading: {type: 'Heading', props: {text: 'Sales'}}},
}

describe('generateStoreReportSpec', () => {
  test('returns the validated spec on success', async () => {
    const generateSpec = vi.fn().mockResolvedValue({success: true, spec: validSpec, attempts: 1})

    const outcome = await generateStoreReportSpec(generationInput, {generateSpec})

    expect(generateSpec).toHaveBeenCalledWith(generationInput)
    expect(outcome).toEqual({spec: validSpec})
  })

  test('returns a fallback outcome carrying the failures when every attempt is exhausted', async () => {
    const failures = [{reason: 'Root element "missing" does not exist.', output: '{"root":"missing","elements":{}}'}]
    const generateSpec = vi.fn().mockResolvedValue({success: false, failures})

    const outcome = await generateStoreReportSpec(generationInput, {generateSpec})

    expect(outcome).toEqual({fallback: true, failures})
  })

  test('returns a plain fallback outcome and debugs the reason when generation throws', async () => {
    mockAndCaptureOutput().clear()
    const output = mockAndCaptureOutput()
    const generateSpec = vi.fn().mockRejectedValue(new Error('model unavailable'))

    const outcome = await generateStoreReportSpec(generationInput, {generateSpec})

    expect(outcome).toEqual({fallback: true})
    expect(output.debug()).toContain('Report visualization failed: Error: model unavailable')
  })

  test('returns a plain fallback outcome without throwing when generation rejects with a non-Error', async () => {
    mockAndCaptureOutput().clear()
    const output = mockAndCaptureOutput()
    const generateSpec = vi.fn().mockRejectedValue('boom')

    const outcome = await generateStoreReportSpec(generationInput, {generateSpec})

    expect(outcome).toEqual({fallback: true})
    expect(output.debug()).toContain('Report visualization failed: boom')
  })
})

describe('presentStoreReport', () => {
  test('renders the spec when generation produced one', async () => {
    const renderSpec = vi.fn()
    const renderFallback = vi.fn()

    await presentStoreReport(reportResult, {spec: validSpec}, {renderSpec, renderFallback})

    expect(renderSpec).toHaveBeenCalledWith(validSpec)
    expect(renderFallback).not.toHaveBeenCalled()
  })

  test('prints a visible failure summary, debugs the raw output of every attempt, and falls back to text', async () => {
    mockAndCaptureOutput().clear()
    const output = mockAndCaptureOutput()
    const renderSpec = vi.fn()
    const renderFallback = vi.fn()
    const failures = [
      {reason: 'Root element "missing" does not exist.', output: '{"root":"missing","elements":{}}'},
      {reason: 'The model response contained malformed JSON.', output: '{"root":]}'},
    ]

    await presentStoreReport(reportResult, {fallback: true, failures}, {renderSpec, renderFallback})

    expect(renderSpec).not.toHaveBeenCalled()
    expect(renderFallback).toHaveBeenCalledWith(reportResult, 'text')
    expect(output.warn()).toContain('Could not generate a valid report dashboard after 2 attempt(s)')
    expect(output.warn()).toContain('Root element "missing" does not exist.')
    expect(output.warn()).toContain('The model response contained malformed JSON.')
    expect(output.debug()).toContain('{"root":"missing","elements":{}}')
    expect(output.debug()).toContain('{"root":]}')
  })

  test('falls back to text without a failure summary when generation threw (no failures to report)', async () => {
    const renderSpec = vi.fn()
    const renderFallback = vi.fn()

    await presentStoreReport(reportResult, {fallback: true}, {renderSpec, renderFallback})

    expect(renderSpec).not.toHaveBeenCalled()
    expect(renderFallback).toHaveBeenCalledWith(reportResult, 'text')
  })

  test('falls back to text and debugs the reason when rendering the spec throws', async () => {
    mockAndCaptureOutput().clear()
    const output = mockAndCaptureOutput()
    const renderSpec = vi.fn().mockRejectedValue(new Error('render failed'))
    const renderFallback = vi.fn()

    await presentStoreReport(reportResult, {spec: validSpec}, {renderSpec, renderFallback})

    expect(renderFallback).toHaveBeenCalledWith(reportResult, 'text')
    expect(output.debug()).toContain('Report visualization failed: Error: render failed')
  })

  test('falls back to text without throwing when rendering the spec rejects with a non-Error', async () => {
    mockAndCaptureOutput().clear()
    const output = mockAndCaptureOutput()
    const renderSpec = vi.fn().mockRejectedValue('boom')
    const renderFallback = vi.fn()

    await presentStoreReport(reportResult, {spec: validSpec}, {renderSpec, renderFallback})

    expect(renderFallback).toHaveBeenCalledWith(reportResult, 'text')
    expect(output.debug()).toContain('Report visualization failed: boom')
  })
})
