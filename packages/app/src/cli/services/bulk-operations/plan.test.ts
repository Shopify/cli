import {resolveBulkPlan} from './plan.js'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, test, expect} from 'vitest'

const NAMED_MUTATION = 'mutation SetProducts($input: ProductSetInput!) { productSet(input: $input) { product { id } } }'
const SECOND_MUTATION =
  'mutation Publish($id: ID!) { publishablePublish(id: $id, input: []) { publishable { publishedOnCurrentPublication } } }'

async function writePlan(dir: string, contents: unknown): Promise<string> {
  const planPath = joinPath(dir, 'plan.json')
  await writeFile(planPath, typeof contents === 'string' ? contents : JSON.stringify(contents))
  return planPath
}

describe('resolveBulkPlan', () => {
  test('resolves ordered operations from mutation/variable files relative to the plan file', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, 'SetProducts.graphql'), NAMED_MUTATION)
      await writeFile(joinPath(dir, 'SetProducts.jsonl'), '{"$key":"a","input":{}}')
      await writeFile(joinPath(dir, 'Publish.graphql'), SECOND_MUTATION)
      await writeFile(joinPath(dir, 'Publish.jsonl'), '{"id":"$ref:SetProducts[a].product.id"}')
      const planPath = await writePlan(dir, [
        {mutationFile: 'SetProducts.graphql', variableFile: 'SetProducts.jsonl'},
        {mutationFile: 'Publish.graphql', variableFile: 'Publish.jsonl'},
      ])

      const operations = await resolveBulkPlan(planPath)

      expect(operations).toEqual([
        {mutation: NAMED_MUTATION, variablesJsonl: '{"$key":"a","input":{}}'},
        {mutation: SECOND_MUTATION, variablesJsonl: '{"id":"$ref:SetProducts[a].product.id"}'},
      ])
    })
  })

  test('resolves inline mutation and variables', async () => {
    await inTemporaryDirectory(async (dir) => {
      const planPath = await writePlan(dir, [
        {mutation: NAMED_MUTATION, variables: ['{"$key":"a","input":{}}', '{"$key":"b","input":{}}']},
      ])

      const operations = await resolveBulkPlan(planPath)

      expect(operations).toEqual([
        {mutation: NAMED_MUTATION, variablesJsonl: '{"$key":"a","input":{}}\n{"$key":"b","input":{}}'},
      ])
    })
  })

  test('throws when the plan file does not exist', async () => {
    await inTemporaryDirectory(async (dir) => {
      await expect(resolveBulkPlan(joinPath(dir, 'missing.json'))).rejects.toThrowError(/Plan file not found/)
    })
  })

  test('throws when the plan file is not valid JSON', async () => {
    await inTemporaryDirectory(async (dir) => {
      const planPath = await writePlan(dir, 'not json {')
      await expect(resolveBulkPlan(planPath)).rejects.toThrowError(/not valid JSON/)
    })
  })

  test('throws when the plan is not a non-empty array', async () => {
    await inTemporaryDirectory(async (dir) => {
      const planPath = await writePlan(dir, [])
      await expect(resolveBulkPlan(planPath)).rejects.toThrowError(/non-empty JSON array/)
    })
  })

  test('throws when an operation is missing a mutation', async () => {
    await inTemporaryDirectory(async (dir) => {
      const planPath = await writePlan(dir, [{variables: ['{"input":{}}']}])
      await expect(resolveBulkPlan(planPath)).rejects.toThrowError(/operation 1 is missing a mutation/)
    })
  })

  test('throws when an operation sets both mutation and mutationFile', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, 'm.graphql'), NAMED_MUTATION)
      const planPath = await writePlan(dir, [
        {mutation: NAMED_MUTATION, mutationFile: 'm.graphql', variables: ['{"input":{}}']},
      ])
      await expect(resolveBulkPlan(planPath)).rejects.toThrowError(/only one of "mutation" or "mutationFile"/)
    })
  })

  test('throws when a mutation is anonymous', async () => {
    await inTemporaryDirectory(async (dir) => {
      const planPath = await writePlan(dir, [
        {mutation: 'mutation { productSet(input: {}) { product { id } } }', variables: ['{"input":{}}']},
      ])
      await expect(resolveBulkPlan(planPath)).rejects.toThrowError(/must be a named mutation/)
    })
  })

  test('throws when an operation is a query, not a mutation', async () => {
    await inTemporaryDirectory(async (dir) => {
      const planPath = await writePlan(dir, [
        {mutation: 'query GetProducts { products(first: 1) { nodes { id } } }', variables: ['{}']},
      ])
      await expect(resolveBulkPlan(planPath)).rejects.toThrowError(/must be a GraphQL mutation/)
    })
  })

  test('throws when an operation has no variables', async () => {
    await inTemporaryDirectory(async (dir) => {
      const planPath = await writePlan(dir, [{mutation: NAMED_MUTATION}])
      await expect(resolveBulkPlan(planPath)).rejects.toThrowError(/is missing variables/)
    })
  })

  test('throws when the variables are empty', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, 'empty.jsonl'), '   \n')
      const planPath = await writePlan(dir, [{mutation: NAMED_MUTATION, variableFile: 'empty.jsonl'}])
      await expect(resolveBulkPlan(planPath)).rejects.toThrowError(/has empty variables/)
    })
  })

  test('throws when a referenced mutation file is missing', async () => {
    await inTemporaryDirectory(async (dir) => {
      const planPath = await writePlan(dir, [{mutationFile: 'nope.graphql', variables: ['{"input":{}}']}])
      await expect(resolveBulkPlan(planPath)).rejects.toThrowError(/not found at .*nope\.graphql/)
    })
  })
})
