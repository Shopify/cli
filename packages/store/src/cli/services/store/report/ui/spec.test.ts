import {generateReportSpecText, parseAndValidateReportSpec, validateReportSpec} from './spec.js'
import {describe, expect, test} from 'vitest'
import type {Spec} from '@json-render/core'
import type {StoreReportResult} from '../types.js'

const validHeadingSpec = {
  root: 'heading',
  elements: {
    heading: {type: 'Heading', props: {text: 'Sales {today} and "quotes"'}},
  },
}

function expectValid(value: unknown): Spec {
  const result = validateReportSpec(value)
  expect(result.success).toBe(true)
  if (!result.success) throw new Error(result.reason)
  return result.spec
}

function expectInvalid(value: unknown, reason: string): void {
  const result = validateReportSpec(value)
  expect(result).toEqual({success: false, reason: expect.stringContaining(reason)})
}

describe('generateReportSpecText', () => {
  test('passes separated instructions and untrusted report data through the injected model seam', async () => {
    const report: StoreReportResult = {
      store: 'shop.myshopify.com',
      apiVersion: '2026-04',
      question: 'What were my sales?',
      api: 'shopifyql',
      query: 'FROM sales SHOW total_sales',
      rationale: 'A sales total.',
      result: {rows: [{total_sales: 10}]},
    }
    const proxyToken = 'synthetic-proxy-token'

    const output = await generateReportSpecText(
      {
        report,
        proxyBaseUrl: 'https://proxy.test/v1',
        proxyToken,
        model: 'test-model',
      },
      {
        runModel: async (params) => {
          expect(params.instructions).toContain('exactly one complete JSON object')
          expect(params.request).toContain('BEGIN UNTRUSTED REPORT DATA')
          expect(params.request).toContain('"question": "What were my sales?"')
          expect(params.instructions).not.toContain(proxyToken)
          expect(params.request).not.toContain(proxyToken)
          expect(params).toMatchObject({
            proxyBaseUrl: 'https://proxy.test/v1',
            proxyToken,
            model: 'test-model',
          })
          return JSON.stringify(validHeadingSpec)
        },
      },
    )

    expect(output).toBe(JSON.stringify(validHeadingSpec))
  })
})

describe('parseAndValidateReportSpec', () => {
  test.each([
    ['raw JSON', JSON.stringify(validHeadingSpec)],
    ['a fenced block', `\`\`\`json\n${JSON.stringify(validHeadingSpec)}\n\`\`\``],
    ['prose-wrapped JSON', `Here is the visualization:\n${JSON.stringify(validHeadingSpec)}\nDone.`],
  ])('parses %s while respecting braces and escaped quotes inside strings', (_label, modelOutput) => {
    const result = parseAndValidateReportSpec(modelOutput)

    expect(result.success).toBe(true)
  })

  test('rejects malformed balanced JSON', () => {
    expect(parseAndValidateReportSpec('Result: {"root":]}')).toEqual({
      success: false,
      reason: 'The model response contained malformed JSON.',
    })
  })

  test('rejects output without a complete object', () => {
    expect(parseAndValidateReportSpec('Result: {"root":"heading"')).toEqual({
      success: false,
      reason: 'The model response did not contain a complete JSON object.',
    })
  })
})

describe('validateReportSpec structural checks', () => {
  test('rejects non-plain values', () => {
    expectInvalid(new Date(), 'plain JSON values')
  })

  test('rejects cyclic objects instead of recursing indefinitely', () => {
    const cyclicValue: Record<string, unknown> = {}
    cyclicValue.self = cyclicValue

    expectInvalid(cyclicValue, 'plain JSON values')
  })

  test('rejects top-level state before component props are considered', () => {
    expectInvalid({...validHeadingSpec, state: {}}, 'forbidden top-level fields')
  })

  test.each(['visible', 'on', 'repeat', 'watch'])('rejects the forbidden element field %s', (field) => {
    expectInvalid(
      {
        root: 'heading',
        elements: {heading: {...validHeadingSpec.elements.heading, [field]: {}}},
      },
      'forbidden fields',
    )
  })

  test('rejects unknown components', () => {
    expectInvalid(
      {root: 'spinner', elements: {spinner: {type: 'Spinner', props: {label: 'Loading'}}}},
      'unknown component',
    )
  })

  test('rejects nested directive keys in props', () => {
    expectInvalid(
      {
        root: 'table',
        elements: {
          table: {
            type: 'Table',
            props: {
              columns: [{header: 'Sales', key: 'sales'}],
              rows: [{sales: {$state: '/sales'}}],
            },
          },
        },
      },
      'forbidden $ directive',
    )
  })

  test('rejects non-string children', () => {
    expectInvalid({root: 'box', elements: {box: {type: 'Box', props: {}, children: [1]}}}, 'children must be an array')
  })
})

describe('validateReportSpec component props', () => {
  test('normalizes omitted nullable styling fields at the top level and inside arrays', () => {
    const spec = expectValid({
      root: 'table',
      elements: {
        table: {
          type: 'Table',
          props: {
            columns: [{header: 'Sales', key: 'sales'}],
            rows: [{sales: '$10'}],
          },
        },
      },
    })

    expect(spec.elements.table?.props).toMatchObject({
      columns: [{header: 'Sales', key: 'sales', width: null, align: null}],
      rows: [{sales: '$10'}],
      borderStyle: null,
      backgroundColor: null,
      headerColor: null,
    })
  })

  test('rejects numeric Table cells', () => {
    expectInvalid(
      {
        root: 'table',
        elements: {
          table: {
            type: 'Table',
            props: {columns: [{header: 'Sales', key: 'sales'}], rows: [{sales: 10}]},
          },
        },
      },
      'invalid props',
    )
  })

  test('rejects unknown top-level props', () => {
    expectInvalid(
      {root: 'heading', elements: {heading: {type: 'Heading', props: {text: 'Sales', surprise: true}}}},
      'invalid props',
    )
  })

  test('rejects unknown nested props that the upstream schema would strip', () => {
    expectInvalid(
      {
        root: 'table',
        elements: {
          table: {
            type: 'Table',
            props: {
              columns: [{header: 'Sales', key: 'sales', surprise: true}],
              rows: [{sales: '$10'}],
            },
          },
        },
      },
      'unknown fields',
    )
  })

  test('does not normalize missing semantic required props', () => {
    expectInvalid({root: 'heading', elements: {heading: {type: 'Heading', props: {}}}}, 'invalid props')
  })
})

describe('validateReportSpec graph checks', () => {
  test('rejects a missing root', () => {
    expectInvalid({...validHeadingSpec, root: 'missing'}, 'does not exist')
  })

  test('rejects a missing child', () => {
    expectInvalid(
      {root: 'box', elements: {box: {type: 'Box', props: {}, children: ['missing']}}},
      'references missing child',
    )
  })

  test('rejects cycles', () => {
    expectInvalid(
      {
        root: 'first',
        elements: {
          first: {type: 'Box', props: {}, children: ['second']},
          second: {type: 'Card', props: {}, children: ['first']},
        },
      },
      'contains a cycle',
    )
  })
})
