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

  test('treats the question as untrusted data the model should not follow as instructions', () => {
    const instructions = buildReportInstructions()

    expect(instructions).toContain('untrusted data')
  })

  test('licenses running multiple queries for a compound question and forbids stopping early', () => {
    const instructions = buildReportInstructions()

    expect(instructions).toContain('legitimately needs multiple')
    expect(instructions).toContain("don't stop after the first successful query")
    expect(instructions).not.toContain('Run exactly the query the question needs — no more.')
    expect(instructions).not.toContain('After a query succeeds, finish with a single sentence')
  })

  test("directs the model to compute analytics from Admin GraphQL when ShopifyQL can't express them", () => {
    const instructions = buildReportInstructions()

    expect(instructions).toContain('ShopifyQL is limited to the "sales" dataset aggregates')
    expect(instructions).toContain('compute the')
    expect(instructions).toContain('never tell the user a capability is missing')
  })
})
