import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {writeFile} from '@shopify/cli-kit/node/fs'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {writeOrOutputStoreExecuteResult} from './result.js'

vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/ui')

function captureStandardStreams() {
  const stdout: string[] = []
  const stderr: string[] = []

  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    stdout.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
    return true
  }) as typeof process.stdout.write)
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    stderr.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
    return true
  }) as typeof process.stderr.write)

  return {
    stdout: () => stdout.join(''),
    stderr: () => stderr.join(''),
    restore: () => {
      stdoutSpy.mockRestore()
      stderrSpy.mockRestore()
    },
  }
}

describe('writeOrOutputStoreExecuteResult', () => {
  const originalUnitTestEnv = process.env.SHOPIFY_UNIT_TEST

  beforeEach(() => {
    vi.clearAllMocks()
    mockAndCaptureOutput().clear()
  })

  afterEach(() => {
    process.env.SHOPIFY_UNIT_TEST = originalUnitTestEnv
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
    expect(output.output()).toContain('Test shop')
  })

  test('suppresses success rendering in json mode', async () => {
    const output = mockAndCaptureOutput()

    await writeOrOutputStoreExecuteResult({data: {shop: {name: 'Test shop'}}}, undefined, 'json')

    expect(renderSuccess).not.toHaveBeenCalled()
    expect(output.output()).toContain('Test shop')
  })

  test('writes json results to stdout without writing to stderr', async () => {
    process.env.SHOPIFY_UNIT_TEST = 'false'
    const streams = captureStandardStreams()

    try {
      await writeOrOutputStoreExecuteResult({data: {shop: {name: 'Test shop'}}}, undefined, 'json')
    } finally {
      streams.restore()
    }

    expect(streams.stdout()).toContain('"name": "Test shop"')
    expect(streams.stderr()).toBe('')
  })

  test('suppresses success rendering when writing a file in json mode', async () => {
    await writeOrOutputStoreExecuteResult({data: {shop: {name: 'Test shop'}}}, '/tmp/results.json', 'json')

    expect(writeFile).toHaveBeenCalledWith('/tmp/results.json', expect.stringContaining('Test shop'))
    expect(renderSuccess).not.toHaveBeenCalled()
  })
})
