import {mockAndCaptureStandardStreams, withCapturedStandardStreams} from './output.js'
import {outputInfo, outputResult} from '../output.js'
import {isUnitTest} from '../context/local.js'
import {environmentVariables} from '../../../private/node/constants.js'
import {describe, expect, test, vi} from 'vitest'
import type {CapturedStandardStreams} from './output.js'

describe('withCapturedStandardStreams', () => {
  test('captures output functions on the standard streams and disables unit-test suppression', async () => {
    expect(isUnitTest()).toBe(true)

    const returned = await withCapturedStandardStreams(async ({stdout, stderr}) => {
      expect(isUnitTest()).toBe(false)
      outputResult('command result')
      outputInfo('diagnostic message')
      expect(stdout()).toBe('command result\n')
      expect(stderr()).toBe('diagnostic message\n')
      return 'callback value'
    })

    expect(returned).toBe('callback value')
    expect(isUnitTest()).toBe(true)
    // Computed access on purpose: Vitest compile-replaces the literal process.env.SHOPIFY_UNIT_TEST expression.
    expect(process.env[environmentVariables.unitTest]).toBe('1')
  })

  test('restores a previously undefined environment variable', async () => {
    const previousValue = process.env[environmentVariables.unitTest]
    delete process.env[environmentVariables.unitTest]

    try {
      await withCapturedStandardStreams(async () => {
        expect(process.env[environmentVariables.unitTest]).toBe('0')
      })

      expect(environmentVariables.unitTest in process.env).toBe(false)
    } finally {
      process.env[environmentVariables.unitTest] = previousValue
    }
  })

  test('restores streams and unit-test detection when the callback throws, keeping output readable', async () => {
    const stdoutWrite = process.stdout.write
    const stderrWrite = process.stderr.write
    let captured: CapturedStandardStreams | undefined

    await expect(
      withCapturedStandardStreams(async (streams) => {
        captured = streams
        outputResult('written before failing')
        throw new Error('command aborted')
      }),
    ).rejects.toThrow('command aborted')

    expect(process.stdout.write).toBe(stdoutWrite)
    expect(process.stderr.write).toBe(stderrWrite)
    expect(isUnitTest()).toBe(true)
    expect(process.env[environmentVariables.unitTest]).toBe('1')
    expect(captured?.stdout()).toBe('written before failing\n')
  })
})

describe('mockAndCaptureStandardStreams', () => {
  test('captures stdout, stderr, and console warnings separately', () => {
    const streams = mockAndCaptureStandardStreams()

    try {
      expect(process.stdout.write('result\n')).toBe(true)
      process.stderr.write('diagnostic\n')
      // eslint-disable-next-line no-console
      console.warn('Warning: %s', 'example')

      expect(streams.stdout()).toBe('result\n')
      expect(streams.stderr()).toBe('diagnostic\nWarning: example\n')
    } finally {
      streams.restore()
    }
  })

  test('preserves byte chunks and string encodings', () => {
    const streams = mockAndCaptureStandardStreams()

    try {
      const encoded = Buffer.from('€')
      process.stdout.write(encoded.subarray(0, 1))
      process.stdout.write(new Uint8Array(encoded.subarray(1)))
      process.stdout.write('21', 'hex')

      expect(streams.stdout()).toBe('€!')
      expect(streams.stderr()).toBe('')
    } finally {
      streams.restore()
    }
  })

  test('calls write callbacks asynchronously, including empty writes used to flush output', async () => {
    const streams = mockAndCaptureStandardStreams()
    const callback = vi.fn()

    try {
      process.stdout.write('', callback)
      expect(callback).not.toHaveBeenCalled()
      await new Promise<void>((resolve) => process.stderr.write('message', 'utf8', () => resolve()))

      expect(callback).toHaveBeenCalledOnce()
      expect(streams.stdout()).toBe('')
      expect(streams.stderr()).toBe('message')
    } finally {
      streams.restore()
    }
  })

  test('restores the original writers and leaves captured output available', () => {
    const stdoutWrite = process.stdout.write
    const stderrWrite = process.stderr.write
    // eslint-disable-next-line no-console
    const consoleWarn = console.warn
    const streams = mockAndCaptureStandardStreams()

    try {
      process.stdout.write('captured')
    } finally {
      streams.restore()
    }

    expect(process.stdout.write).toBe(stdoutWrite)
    expect(process.stderr.write).toBe(stderrWrite)
    // eslint-disable-next-line no-console
    expect(console.warn).toBe(consoleWarn)
    expect(streams.stdout()).toBe('captured')
  })
})
