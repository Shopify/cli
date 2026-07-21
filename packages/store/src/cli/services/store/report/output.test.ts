import {renderStoreReportResult, shapeStoreReportJson} from './output.js'
import {beforeEach, describe, expect, test} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import type {StoreReportResult} from './types.js'

const shopifyqlResult: StoreReportResult = {
  store: 'my-shop.myshopify.com',
  apiVersion: '2026-04',
  question: 'What were my sales last month?',
  api: 'shopifyql',
  query: 'FROM sales SHOW total_sales SINCE -30d',
  rationale: 'Sales trend over the last 30 days.',
  result: {
    columns: [{name: 'total_sales', dataType: 'money', displayName: 'Total sales'}],
    rows: [{total_sales: 123.45}],
  },
}

const adminResult: StoreReportResult = {
  store: 'my-shop.myshopify.com',
  apiVersion: '2026-04',
  question: 'What is my shop name?',
  api: 'admin',
  query: '{ shop { name } }',
  rationale: 'Direct catalog lookup.',
  result: {shop: {name: 'My Shop'}},
}

describe('shapeStoreReportJson', () => {
  test('shapes the result into a plain, serializable document', () => {
    expect(shapeStoreReportJson(shopifyqlResult)).toEqual({
      store: 'my-shop.myshopify.com',
      apiVersion: '2026-04',
      question: 'What were my sales last month?',
      api: 'shopifyql',
      query: 'FROM sales SHOW total_sales SINCE -30d',
      rationale: 'Sales trend over the last 30 days.',
      result: shopifyqlResult.result,
    })
  })
})

describe('renderStoreReportResult', () => {
  beforeEach(() => {
    mockAndCaptureOutput().clear()
  })

  test('emits byte-exact JSON when the format is json', () => {
    const output = mockAndCaptureOutput()

    renderStoreReportResult(shopifyqlResult, 'json')

    // The test capture stores the outputResult payload without consoleLog's trailing newline.
    expect(`${output.output()}\n`).toBe(`{
  "store": "my-shop.myshopify.com",
  "apiVersion": "2026-04",
  "question": "What were my sales last month?",
  "api": "shopifyql",
  "query": "FROM sales SHOW total_sales SINCE -30d",
  "rationale": "Sales trend over the last 30 days.",
  "result": {
    "columns": [
      {
        "name": "total_sales",
        "dataType": "money",
        "displayName": "Total sales"
      }
    ],
    "rows": [
      {
        "total_sales": 123.45
      }
    ]
  }
}
`)
  })

  test('echoes the query and renders a table for a ShopifyQL result', () => {
    const output = mockAndCaptureOutput()

    renderStoreReportResult(shopifyqlResult, 'text')

    expect(output.info()).toContain('FROM sales SHOW total_sales SINCE -30d')
    expect(output.info()).toContain('Total sales')
    expect(output.info()).toContain('123.45')
  })

  test('does not reprint the agent summary in text mode (it already streamed live)', () => {
    const output = mockAndCaptureOutput()

    renderStoreReportResult(shopifyqlResult, 'text')

    expect(output.info()).not.toContain('Sales trend over the last 30 days.')
  })

  test('reports no data for a ShopifyQL result with no rows', () => {
    const output = mockAndCaptureOutput()

    renderStoreReportResult({...shopifyqlResult, result: {columns: [], rows: []}}, 'text')

    expect(output.info()).toContain('No data for this query.')
  })

  test('echoes the query and pretty-prints JSON for an Admin result', () => {
    const output = mockAndCaptureOutput()

    renderStoreReportResult(adminResult, 'text')

    expect(output.info()).toContain('{ shop { name } }')
    expect(output.output()).toContain('"name": "My Shop"')
  })

  test('reports no data for an Admin result with a null payload', () => {
    const output = mockAndCaptureOutput()

    renderStoreReportResult({...adminResult, result: null}, 'text')

    expect(output.info()).toContain('No data for this query.')
  })
})
