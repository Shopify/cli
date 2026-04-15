import {getBundleSize, formatBundleSize} from './bundle-size.js'
import {describe, expect, test, vi} from 'vitest'
import {readFile} from '@shopify/cli-kit/node/fs'
import {deflate} from 'node:zlib'
import {promisify} from 'node:util'

const deflateAsync = promisify(deflate)

vi.mock('@shopify/cli-kit/node/fs')

describe('getBundleSize', () => {
  test('returns raw and compressed sizes', async () => {
    // Given
    const content = 'a'.repeat(10000)
    vi.mocked(readFile).mockResolvedValue(content as any)

    // When
    const result = await getBundleSize('/some/path.js')

    // Then
    expect(result.rawBytes).toBe(10000)
    expect(result.compressedBytes).toBe((await deflateAsync(Buffer.from(content))).byteLength)
    expect(result.compressedBytes).toBeLessThan(result.rawBytes)
  })

  test('compressed size uses deflate to match the backend (Ruby Zlib::Deflate.deflate)', async () => {
    // Given
    const content = JSON.stringify({key: 'value', nested: {array: [1, 2, 3]}})
    vi.mocked(readFile).mockResolvedValue(content as any)

    // When
    const result = await getBundleSize('/some/path.js')

    // Then
    const expectedCompressed = (await deflateAsync(Buffer.from(content))).byteLength
    expect(result.compressedBytes).toBe(expectedCompressed)
  })
})

describe('formatBundleSize', () => {
  test('returns formatted size string with raw and compressed sizes', async () => {
    // Given
    const content = 'x'.repeat(50000)
    const compressedSize = (await deflateAsync(Buffer.from(content))).byteLength
    vi.mocked(readFile).mockResolvedValue(content as any)

    // When
    const result = await formatBundleSize('/some/path.js')

    // Then
    const expectedRaw = (50000 / 1024).toFixed(1)
    const expectedCompressed = (compressedSize / 1024).toFixed(1)
    expect(result).toBe(` (${expectedRaw} KB original, ~${expectedCompressed} KB compressed)`)
  })

  test('formats MB for large files', async () => {
    // Given
    const content = 'a'.repeat(2 * 1024 * 1024)
    const compressedSize = (await deflateAsync(Buffer.from(content))).byteLength
    vi.mocked(readFile).mockResolvedValue(content as any)

    // When
    const result = await formatBundleSize('/some/path.js')

    // Then
    const expectedRaw = (Buffer.byteLength(content) / (1024 * 1024)).toFixed(2)
    const expectedCompressed = (compressedSize / 1024).toFixed(1)
    expect(result).toBe(` (${expectedRaw} MB original, ~${expectedCompressed} KB compressed)`)
  })

  test('returns empty string on error', async () => {
    // Given
    vi.mocked(readFile).mockRejectedValue(new Error('file not found'))

    // When
    const result = await formatBundleSize('/missing/path.js')

    // Then
    expect(result).toBe('')
  })
})
