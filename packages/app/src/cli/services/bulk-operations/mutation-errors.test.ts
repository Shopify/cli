import {resultsContainMutationErrors} from './mutation-errors.js'
import {expect, test} from 'vitest'
import {readFile} from '@shopify/cli-kit/node/fs'
import {fileURLToPath} from 'node:url'

test.each([
  {
    query: 'mutation { productUpdate { userErrors { message } } }',
    data: {productUpdate: {userErrors: [{message: 'Rejected'}]}},
  },
  {
    query: 'mutation { update: productUpdate { errors: userErrors { message } } }',
    data: {update: {errors: [{message: 'Rejected'}]}},
  },
  {
    query:
      'mutation { ... on Mutation { update: productUpdate { ... on ProductUpdatePayload { errors: userErrors { message } } } } }',
    data: {update: {errors: [{message: 'Rejected'}]}},
  },
])('detects selected mutation errors in $query', ({query, data}) => {
  expect(resultsContainMutationErrors(`${JSON.stringify({data})}\n`, query)).toBe(true)
})

test('detects aliases in named fragments after a root metadata field', async () => {
  const query = await readFile(fileURLToPath(new URL('./fixtures/aliased-mutation.graphql', import.meta.url)))
  const results = JSON.stringify({data: {__typename: 'Mutation', update: {errors: [{message: 'Rejected'}]}}})
  expect(resultsContainMutationErrors(results, query)).toBe(true)
})

test('ignores ordinary fields aliased as errors or userErrors', () => {
  const query = 'mutation { metafieldsSet { errors: metafields { id } userErrors: metafields { id } } }'
  const results = JSON.stringify({
    data: {metafieldsSet: {errors: [{id: '1'}], userErrors: [{id: '1'}]}},
  })
  expect(resultsContainMutationErrors(results, query)).toBe(false)
})

test.each([{userErrors: []}, {userErrors: null}, {userErrors: undefined}])(
  'does not report missing or empty mutation errors: $userErrors',
  ({userErrors}) => {
    const query = 'mutation { productUpdate { errors: userErrors { message } } }'
    expect(resultsContainMutationErrors(JSON.stringify({data: {productUpdate: {errors: userErrors}}}), query)).toBe(
      false,
    )
  },
)

test('detects top-level GraphQL errors', () => {
  expect(
    resultsContainMutationErrors('{"errors":[{"message":"Rejected"}]}\n', 'mutation { productUpdate { id } }'),
  ).toBe(true)
})

test('keeps scanning after blank or malformed lines', () => {
  const query = 'mutation { productUpdate { errors: userErrors { message } } }'
  const results = '\n{incomplete\n{"data":{"productUpdate":{"errors":[{"message":"Rejected"}]}}}\n'
  expect(resultsContainMutationErrors(results, query)).toBe(true)
})

test('bounds traversal of cyclic fragments', async () => {
  const query = await readFile(fileURLToPath(new URL('./fixtures/cyclic-mutation-fragment.graphql', import.meta.url)))
  const results = '{"data":{"productUpdate":{"errors":[{"message":"Rejected"}]}}}\n'
  expect(resultsContainMutationErrors(results, query)).toBe(true)
})
