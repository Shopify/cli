import {validateGraphQL} from './graphql.js'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

// eslint-disable-next-line @shopify/cli/no-inline-graphql -- Local schema fixture keeps validation tests self-contained.
const schema = `
  schema {
    query: Query
    mutation: Mutation
  }

  type Query {
    shop: Shop!
    product(id: ID!): Product
  }

  type Mutation {
    productCreate(title: String!): Product
  }

  type Shop {
    name: String!
  }

  type Product {
    title: String!
  }
`

describe('validateGraphQL', () => {
  test('validates syntax without a schema file', async () => {
    const result = await validateGraphQL({query: 'query { shop { name } }'})

    expect(result).toMatchObject({
      valid: true,
      issues: [],
      operation: {type: 'query'},
      schema: {source: 'none', validation: 'skipped'},
    })
  })

  test('validates fields against a schema file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const schemaFile = joinPath(tmpDir, 'schema.graphql')
      await writeFile(schemaFile, schema)

      const result = await validateGraphQL({query: 'query { shop { name } }', schemaFile})

      expect(result).toMatchObject({
        valid: true,
        issues: [],
        operation: {type: 'query'},
        schema: {source: 'file', path: schemaFile, validation: 'checked'},
      })
    })
  })

  test('returns schema issues for invalid fields', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const schemaFile = joinPath(tmpDir, 'schema.graphql')
      await writeFile(schemaFile, schema)

      const result = await validateGraphQL({query: 'query { shop { missingField } }', schemaFile})

      expect(result.valid).toBe(false)
      expect(result.issues).toEqual([
        expect.objectContaining({
          stage: 'schema',
          message: expect.stringContaining('Cannot query field "missingField" on type "Shop"'),
        }),
      ])
    })
  })

  test('returns variable coercion issues when schema is available', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const schemaFile = joinPath(tmpDir, 'schema.graphql')
      await writeFile(schemaFile, schema)

      const result = await validateGraphQL({
        query: 'query Product($id: ID!) { product(id: $id) { title } }',
        variables: '{}',
        schemaFile,
      })

      expect(result.valid).toBe(false)
      expect(result.issues).toEqual([
        expect.objectContaining({
          stage: 'variables',
          message: expect.stringContaining('Variable "$id" of required type "ID!" was not provided'),
        }),
      ])
    })
  })

  test('returns syntax issues for invalid GraphQL', async () => {
    const result = await validateGraphQL({query: 'query {'})

    expect(result.valid).toBe(false)
    expect(result.issues).toEqual([
      expect.objectContaining({
        stage: 'syntax',
        message: expect.stringContaining('Syntax Error'),
      }),
    ])
  })

  test('returns variable issues for invalid JSON', async () => {
    const result = await validateGraphQL({query: 'query { shop { name } }', variables: '{'})

    expect(result.valid).toBe(false)
    expect(result.issues).toEqual([
      expect.objectContaining({
        stage: 'variables',
        message: expect.stringContaining('Invalid variables JSON'),
      }),
    ])
  })
})
