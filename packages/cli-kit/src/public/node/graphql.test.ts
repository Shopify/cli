import {containsMutation} from './graphql.js'
import {describe, expect, test} from 'vitest'

describe('containsMutation', () => {
  test('returns false for a query', () => {
    expect(containsMutation('query Shop { shop { name } }')).toBe(false)
  })

  test('returns false for an anonymous query', () => {
    expect(containsMutation('{ shop { name } }')).toBe(false)
  })

  test('returns true for a mutation', () => {
    expect(containsMutation('mutation UpdateShop { shopUpdate(input: {}) { id } }')).toBe(true)
  })

  test('returns false for a subscription', () => {
    expect(containsMutation('subscription Foo { foo { id } }')).toBe(false)
  })

  test('returns false for invalid GraphQL', () => {
    expect(containsMutation('this is not graphql')).toBe(false)
  })

  test('returns false for an empty string', () => {
    expect(containsMutation('')).toBe(false)
  })

  test('returns false for a fragment-only document', () => {
    expect(containsMutation('fragment Foo on Shop { name }')).toBe(false)
  })

  test('with operationName, only checks the named operation', () => {
    // eslint-disable-next-line @shopify/cli/no-inline-graphql
    const document = `
      query Q { shop { name } }
      mutation M { shopUpdate(input: {}) { id } }
    `
    expect(containsMutation(document, 'Q')).toBe(false)
    expect(containsMutation(document, 'M')).toBe(true)
  })

  test('with operationName not in document, returns false', () => {
    const document = 'query Q { shop { name } }'
    expect(containsMutation(document, 'DoesNotExist')).toBe(false)
  })

  test('without operationName but multiple operations, returns true if any is a mutation', () => {
    // eslint-disable-next-line @shopify/cli/no-inline-graphql
    const document = `
      query Q { shop { name } }
      mutation M { shopUpdate(input: {}) { id } }
    `
    expect(containsMutation(document)).toBe(true)
  })

  test('without operationName but multiple queries, returns false', () => {
    const document = `
      query Q1 { shop { name } }
      query Q2 { shop { id } }
    `
    expect(containsMutation(document)).toBe(false)
  })
})
