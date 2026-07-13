import {validateBulkOperations} from './validate.js'
import {adminRequest} from '../admin.js'
import {buildASTSchema, parse, introspectionFromSchema} from 'graphql'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('../admin.js')

const schema = buildASTSchema(
  parse(`
  input ProductSetInput { handle: String, count: Int }
  type Product { id: ID! }
  type ProductSetPayload { product: Product }
  type Mutation { productSet(input: ProductSetInput!): ProductSetPayload }
  type Query { _skip: Boolean }
`),
)

const PRODUCT_SET = 'mutation A($input: ProductSetInput!) { productSet(input: $input) { product { id } } }'

describe('validateBulkOperations', () => {
  const adminSession = {token: 'test-token', storeFqdn: 'test-store.myshopify.com'}

  beforeEach(() => {
    vi.mocked(adminRequest).mockResolvedValue(introspectionFromSchema(schema))
  })

  async function validateOne(operation: string, representativeRow?: {[key: string]: unknown}): Promise<string[]> {
    const [result] = await validateBulkOperations({
      adminSession,
      operations: [{label: 'op', operation, representativeRow}],
    })
    return result!.errors
  }

  test('returns no errors for a schema-valid operation', async () => {
    await expect(validateOne(PRODUCT_SET, {input: {handle: 'x'}})).resolves.toEqual([])
  })

  test('reports a schema error for an unknown selection field', async () => {
    const errors = await validateOne(
      'mutation A($input: ProductSetInput!) { productSet(input: $input) { product { bogus } } }',
      {input: {handle: 'x'}},
    )
    expect(errors.join('\n')).toMatch(/Cannot query field "bogus"/)
  })

  test('reports a syntax error for an invalid document', async () => {
    expect((await validateOne('mutation A( { productSet }')).join('\n')).toMatch(/GraphQL syntax error/)
  })

  test('reports a missing required variable from the representative row', async () => {
    expect((await validateOne(PRODUCT_SET, {})).join('\n')).toMatch(/missing required variable\(s\): \$input/)
  })

  test('reports an input field not defined by type when inlining the representative row', async () => {
    expect((await validateOne(PRODUCT_SET, {input: {bogusField: 1}})).join('\n')).toMatch(/is not defined by type/)
  })

  test('skips coercion for rows containing $ref values to avoid false positives', async () => {
    // `count` is an Int; a raw $ref string would be a type error if coerced, but $refs resolve server-side.
    await expect(validateOne(PRODUCT_SET, {input: {count: '$ref:A[k].n'}})).resolves.toEqual([])
  })

  test('ignores the reserved $key row field', async () => {
    await expect(validateOne(PRODUCT_SET, {$key: 'k', input: {handle: 'x'}})).resolves.toEqual([])
  })

  test('introspects the schema once for multiple operations', async () => {
    await validateBulkOperations({
      adminSession,
      operations: [
        {label: 'op1', operation: PRODUCT_SET, representativeRow: {input: {handle: 'a'}}},
        {label: 'op2', operation: PRODUCT_SET, representativeRow: {input: {handle: 'b'}}},
      ],
    })
    expect(adminRequest).toHaveBeenCalledTimes(1)
  })
})
