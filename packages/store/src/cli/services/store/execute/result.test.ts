import {writeOrOutputStoreExecuteResult} from './result.js'
import {storeExecuteJsonOutputSchema} from './types.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/ui')

describe('writeOrOutputStoreExecuteResult', () => {
  beforeEach(() => {
    mockAndCaptureOutput().clear()
  })

  test('writes results to a file when outputFile is provided', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const outputPath = joinPath(tmpDir, 'results.json')
      const result = {data: {shop: {name: 'Test shop'}}, extensions: {cost: {actualQueryCost: 2}}}

      // When
      await writeOrOutputStoreExecuteResult(result, outputPath)

      // Then
      const content = await readFile(outputPath)
      expect(JSON.parse(content)).toStrictEqual(result)
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'Operation succeeded.',
        body: `Results written to ${outputPath}`,
      })
    })
  })

  test('writes results to stdout when no outputFile is provided', async () => {
    const output = mockAndCaptureOutput()

    await writeOrOutputStoreExecuteResult({data: {shop: {name: 'Test shop'}}})

    expect(renderSuccess).toHaveBeenCalledWith({headline: 'Operation succeeded.'})
    expect(output.output()).toContain('Test shop')
  })

  test('outputs the exact JSON result without a success message', async () => {
    const output = mockAndCaptureOutput()
    const result = {data: {shop: {name: 'Test shop'}}, extensions: {cost: {actualQueryCost: 2}}}

    await writeOrOutputStoreExecuteResult(result, undefined, 'json')

    expect(output.output()).toBe(JSON.stringify(result, null, 2))
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(JSON.parse(output.output())).toStrictEqual(result)
  })

  test.each([
    {},
    null,
    {zebra: false, apple: null, omitted: undefined, nested: {list: [null, 1, 'value']}},
    {extensions: {name: 'Test shop'}, data: false, error: null},
  ])('preserves arbitrary GraphQL fields, order, and omissions: %j', (data) => {
    const result = {data}

    expect(storeExecuteJsonOutputSchema.encode(result)).toBe(JSON.stringify(result, null, 2))
  })

  test.each([undefined, null, 'not an object', 42, []])('rejects invalid response roots: %j', (result) => {
    expect(() => storeExecuteJsonOutputSchema.validate(result)).toThrow()
  })

  test.each([
    {},
    {shop: {name: 'Test shop'}},
    {data: undefined},
    {data: 'not an object'},
    {data: []},
    {data: {}, unexpected: true},
    {data: {}, extensions: null},
    {data: {}, extensions: []},
    {data: {}, extensions: 'not an object'},
  ])('rejects invalid response envelopes: %j', (result) => {
    expect(() => storeExecuteJsonOutputSchema.validate(result)).toThrow()
  })

  test('documents the response envelope in JSON Schema', () => {
    expect(storeExecuteJsonOutputSchema.jsonSchema).toMatchObject({
      type: 'object',
      properties: {data: expect.any(Object), extensions: expect.any(Object)},
      required: ['data'],
      additionalProperties: false,
    })
  })

  test('writes an exact JSON file without a result or success message in JSON mode', async () => {
    const output = mockAndCaptureOutput()
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'result.json')
      const result = {data: {shop: {name: 'Test shop'}, products: []}}

      await writeOrOutputStoreExecuteResult(result, path, 'json')

      await expect(readFile(path)).resolves.toBe(JSON.stringify(result, null, 2))
      expect(output.info()).toBe('')
      expect(renderSuccess).not.toHaveBeenCalled()
    })
  })
})
