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

      // When
      await writeOrOutputStoreExecuteResult({data: {shop: {name: 'Test shop'}}}, outputPath)

      // Then
      const content = await readFile(outputPath)
      expect(content).toContain('Test shop')
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
    const result = {renamedShop: {name: 'Test shop', optional: null}, products: [], enabled: false}

    await writeOrOutputStoreExecuteResult(result, undefined, 'json')

    expect(output.output()).toBe(JSON.stringify(result, null, 2))
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test.each([{}, null, {zebra: false, apple: null, omitted: undefined, nested: {list: [null, 1, 'value']}}])(
    'preserves arbitrary GraphQL fields, order, and omissions: %j',
    (result) => {
      expect(storeExecuteJsonOutputSchema.encode(result)).toBe(JSON.stringify(result, null, 2))
    },
  )

  test.each([undefined, 'not an object', 42, []])('rejects invalid response roots: %j', (result) => {
    expect(() => storeExecuteJsonOutputSchema.validate(result)).toThrow()
  })

  test('writes an exact JSON file without a result or success message in JSON mode', async () => {
    const output = mockAndCaptureOutput()
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'result.json')
      const result = {shop: {name: 'Test shop'}, products: []}

      await writeOrOutputStoreExecuteResult(result, path, 'json')

      await expect(readFile(path)).resolves.toBe(JSON.stringify(result, null, 2))
      expect(output.info()).toBe('')
      expect(renderSuccess).not.toHaveBeenCalled()
    })
  })
})
