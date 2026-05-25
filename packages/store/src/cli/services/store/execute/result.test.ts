import {writeOrOutputStoreExecuteResult} from './result.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {readFile, inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {outputResult} from '@shopify/cli-kit/node/output'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/output', async () => {
  const actual: any = await vi.importActual('@shopify/cli-kit/node/output')
  return {
    ...actual,
    outputResult: vi.fn(),
  }
})

describe('writeOrOutputStoreExecuteResult', () => {
  test('writes results to a file when outputFile is provided', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputFile = joinPath(tmpDir, 'results.json')
      await writeOrOutputStoreExecuteResult({data: {shop: {name: 'Test shop'}}}, outputFile)

      const content = await readFile(outputFile)
      expect(content).toContain('Test shop')
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'Operation succeeded.',
        body: `Results written to ${outputFile}`,
      })
    })
  })

  test('writes results to stdout when no outputFile is provided', async () => {
    await writeOrOutputStoreExecuteResult({data: {shop: {name: 'Test shop'}}})

    expect(renderSuccess).toHaveBeenCalledWith({headline: 'Operation succeeded.'})
    expect(outputResult).toHaveBeenCalledWith(expect.stringContaining('Test shop'))
  })

  test('suppresses success rendering in json mode', async () => {
    await writeOrOutputStoreExecuteResult({data: {shop: {name: 'Test shop'}}}, undefined, 'json')

    expect(renderSuccess).not.toHaveBeenCalled()
    expect(outputResult).toHaveBeenCalledWith(expect.stringContaining('Test shop'))
  })

  test('writes json results to stdout', async () => {
    await writeOrOutputStoreExecuteResult({data: {shop: {name: 'Test shop'}}}, undefined, 'json')

    expect(outputResult).toHaveBeenCalledWith(expect.stringContaining('"name": "Test shop"'))
  })

  test('suppresses success rendering when writing a file in json mode', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputFile = joinPath(tmpDir, 'results.json')
      await writeOrOutputStoreExecuteResult({data: {shop: {name: 'Test shop'}}}, outputFile, 'json')

      const content = await readFile(outputFile)
      expect(content).toContain('Test shop')
      expect(renderSuccess).not.toHaveBeenCalled()
    })
  })
})
