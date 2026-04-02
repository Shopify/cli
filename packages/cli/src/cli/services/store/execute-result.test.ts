import {writeOrOutputStoreExecuteResult} from './execute-result.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {writeFile} from '@shopify/cli-kit/node/fs'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/ui')

describe('writeOrOutputStoreExecuteResult', () => {
  beforeEach(() => {
    mockAndCaptureOutput().clear()
  })

  test('writes results to a file when outputFile is provided', async () => {
    await writeOrOutputStoreExecuteResult({data: {shop: {name: 'Test shop'}}}, '/tmp/results.json')

    expect(writeFile).toHaveBeenCalledWith('/tmp/results.json', expect.stringContaining('Test shop'))
    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Operation succeeded.',
      body: 'Results written to /tmp/results.json',
    })
  })

  test('writes results to stdout when no outputFile is provided', async () => {
    const output = mockAndCaptureOutput()

    await writeOrOutputStoreExecuteResult({data: {shop: {name: 'Test shop'}}})

    expect(renderSuccess).toHaveBeenCalledWith({headline: 'Operation succeeded.'})
    expect(output.info()).toContain('Test shop')
  })
})
