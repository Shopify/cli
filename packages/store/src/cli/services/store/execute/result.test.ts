import {writeOrOutputStoreExecuteResult} from './result.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

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
    mockAndCaptureOutput().clear()
  })

  afterEach(() => {
    process.env.SHOPIFY_UNIT_TEST = originalUnitTestEnv
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

  test('suppresses success rendering in json mode', async () => {
    const output = mockAndCaptureOutput()

    await writeOrOutputStoreExecuteResult({data: {shop: {name: 'Test shop'}}}, undefined, 'json')

    expect(renderSuccess).not.toHaveBeenCalled()
    expect(output.output()).toContain('Test shop')
  })

  test('writes json results to stdout without writing to stderr', async () => {
    process.env.SHOPIFY_UNIT_TEST = 'false'
    vi.resetModules()
    const streams = captureStandardStreams()
    const {writeOrOutputStoreExecuteResult} = await import('./result.js')

    try {
      await writeOrOutputStoreExecuteResult({data: {shop: {name: 'Test shop'}}}, undefined, 'json')
    } finally {
      streams.restore()
    }

    expect(streams.stdout()).toContain('"name": "Test shop"')
    expect(streams.stderr()).toBe('')
  })

  test('emits a structured stdout document and rejects for result-level failure in json file mode', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputPath = joinPath(tmpDir, 'results.json')
      const output = mockAndCaptureOutput()

      await expect(
        writeOrOutputStoreExecuteResult(
          {
            data: {orderCreate: {userErrors: [{message: 'Rejected by the shop'}]}},
            failure: {code: 'USER_ERRORS', details: []},
          },
          outputPath,
          'json',
        ),
      ).rejects.toThrow('GraphQL operation returned user errors (USER_ERRORS).')

      expect(JSON.parse(await readFile(outputPath, {encoding: 'utf8'}))).toEqual({
        orderCreate: {userErrors: [{message: 'Rejected by the shop'}]},
      })
      expect(output.output()).toContain('"outputFile"')
      expect(output.output()).toContain('"success": false')
      expect(output.output()).toContain('"failureCode": "USER_ERRORS"')
      expect(output.output()).not.toContain('Operation succeeded.')
      expect(output.output()).not.toContain('Results written to')
    })
  })

  test('emits the payload and rejects without claiming success for result-level failure in text mode', async () => {
    const output = mockAndCaptureOutput()

    await expect(
      writeOrOutputStoreExecuteResult({
        data: {orderCreate: {userErrors: [{message: 'Rejected by the shop'}]}},
        failure: {code: 'USER_ERRORS', details: []},
      }),
    ).rejects.toThrow('GraphQL operation returned user errors (USER_ERRORS).')

    expect(output.output()).toContain('Rejected by the shop')
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('still reports the written file for result-level failure in text file mode', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputPath = joinPath(tmpDir, 'results.json')
      const output = mockAndCaptureOutput()

      await expect(
        writeOrOutputStoreExecuteResult(
          {
            data: {orderCreate: {userErrors: [{message: 'Rejected by the shop'}]}},
            failure: {code: 'USER_ERRORS', details: []},
          },
          outputPath,
        ),
      ).rejects.toThrow('GraphQL operation returned user errors (USER_ERRORS).')

      await expect(readFile(outputPath, {encoding: 'utf8'})).resolves.toContain('Rejected by the shop')
      expect(output.output()).toContain(`Results written to ${outputPath}`)
      expect(renderSuccess).not.toHaveBeenCalled()
    })
  })

  test('suppresses success rendering when writing a file in json mode', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const outputPath = joinPath(tmpDir, 'results.json')

      // When
      await writeOrOutputStoreExecuteResult({data: {shop: {name: 'Test shop'}}}, outputPath, 'json')

      // Then
      const content = await readFile(outputPath)
      expect(content).toContain('Test shop')
      expect(renderSuccess).not.toHaveBeenCalled()
    })
  })
})
