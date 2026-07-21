import {buildReportInstructions} from './prompt.js'
import {describe, expect, test} from 'vitest'

describe('buildReportInstructions', () => {
  test('includes the tool names, routing rules, ShopifyQL cheat sheet, and dev docs guidance', () => {
    const instructions = buildReportInstructions()

    expect(instructions).toContain('run_shopifyql')
    expect(instructions).toContain('run_admin_graphql')
    expect(instructions).toContain('FROM sales SHOW total_sales, orders')
    expect(instructions).toContain('learn_shopify_api')
  })

  test('tells the model to pass only the ShopifyQL string, not wrapped in GraphQL', () => {
    const instructions = buildReportInstructions()

    expect(instructions).toContain('pass ONLY')
  })

  test('biases toward the forced api when one is provided', () => {
    const instructions = buildReportInstructions({forcedApi: 'admin'})

    expect(instructions).toContain('This run prefers the "admin" surface')
  })

  test('omits the forced-api bias when no api is provided', () => {
    const instructions = buildReportInstructions()

    expect(instructions).not.toContain('prefers the')
  })

  test('treats the question as untrusted data the model should not follow as instructions', () => {
    const instructions = buildReportInstructions()

    expect(instructions).toContain('untrusted data')
  })
})
