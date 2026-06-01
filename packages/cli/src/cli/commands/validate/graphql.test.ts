import ValidateGraphQL from './graphql.js'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test} from 'vitest'

describe('ValidateGraphQL', () => {
  test('outputs JSON validation results', async () => {
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    await ValidateGraphQL.run(['--query', 'query { shop { name } }', '--json'], import.meta.url)

    const output = JSON.parse(outputMock.output())
    expect(output).toMatchObject({
      valid: true,
      issues: [],
      operation: {type: 'query'},
      schema: {source: 'none', validation: 'skipped'},
    })
  })

  test('exits silently after outputting invalid JSON results', async () => {
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    await expect(ValidateGraphQL.run(['--query', 'query {', '--json'], import.meta.url)).rejects.toThrow()

    const output = JSON.parse(outputMock.output())
    expect(output.valid).toBe(false)
    expect(output.issues).toEqual([expect.objectContaining({stage: 'syntax'})])
  })
})
