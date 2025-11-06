import {parseGraphQLOperation} from './graphql-parser.js'
import {describe, expect, test} from 'vitest'

/* eslint-disable @shopify/cli/no-inline-graphql */
describe('parseGraphQLOperation', () => {
  test('returns "query" for a query operation', () => {
    const query = `
      query {
        products {
          id
          title
        }
      }
    `

    const result = parseGraphQLOperation(query)

    expect(result).toBe('query')
  })

  test('returns "mutation" for a mutation operation', () => {
    const mutation = `
      mutation {
        productCreate(input: {title: "test"}) {
          product {
            id
          }
        }
      }
    `

    const result = parseGraphQLOperation(mutation)

    expect(result).toBe('mutation')
  })

  test('returns "subscription" for a subscription operation', () => {
    const subscription = `
      subscription {
        productUpdated {
          id
          title
        }
      }
    `

    const result = parseGraphQLOperation(subscription)

    expect(result).toBe('subscription')
  })

  test('handles named operations', () => {
    const query = `
      query GetProducts {
        products {
          id
        }
      }
    `

    const result = parseGraphQLOperation(query)

    expect(result).toBe('query')
  })

  test('handles operations with variables', () => {
    const query = `
      query GetProduct($id: ID!) {
        product(id: $id) {
          id
          title
        }
      }
    `

    const result = parseGraphQLOperation(query)

    expect(result).toBe('query')
  })

  test('throws error for document with no operation', () => {
    const fragment = `
      fragment ProductFields on Product {
        id
        title
      }
    `

    expect(() => parseGraphQLOperation(fragment)).toThrow('no operation found in graphql document')
  })

  test('throws error for invalid graphql syntax', () => {
    const invalid = 'not valid graphql'

    expect(() => parseGraphQLOperation(invalid)).toThrow()
  })
})
/* eslint-enable @shopify/cli/no-inline-graphql */
