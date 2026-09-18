import {mockAndCaptureStandardStreams} from './output.js'
import {describe, expect, test, vi} from 'vitest'

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
