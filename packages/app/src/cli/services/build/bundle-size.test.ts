import {getBundleSize, formatBundleSize} from './bundle-size.js'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {deflate} from 'node:zlib'
import {promisify} from 'node:util'

const deflateAsync = promisify(deflate)

describe('getBundleSize', () => {
  test('returns raw and compressed sizes', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const content = 'a'.repeat(10000)
      const filePath = joinPath(tmpDir, 'bundle.js')
      await writeFile(filePath, content)

      // When
      const result = await getBundleSize(filePath)

      // Then
      expect(result.rawBytes).toBe(10000)
      expect(result.compressedBytes).toBe((await deflateAsync(Buffer.from(content))).byteLength)
      expect(result.compressedBytes).toBeLessThan(result.rawBytes)
    })
  })

  test('compressed size uses deflate to match the backend (Ruby Zlib::Deflate.deflate)', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const content = JSON.stringify({key: 'value', nested: {array: [1, 2, 3]}})
      const filePath = joinPath(tmpDir, 'bundle.js')
      await writeFile(filePath, content)

      // When
      const result = await getBundleSize(filePath)

      // Then
      const expectedCompressed = (await deflateAsync(Buffer.from(content))).byteLength
      expect(result.compressedBytes).toBe(expectedCompressed)
    })
  })
})

describe('formatBundleSize', () => {
  test('returns formatted size string with raw and compressed sizes', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const content = 'x'.repeat(50000)
      const filePath = joinPath(tmpDir, 'bundle.js')
      await writeFile(filePath, content)
      const compressedSize = (await deflateAsync(Buffer.from(content))).byteLength

      // When
      const result = await formatBundleSize(filePath)

      // Then
      const expectedRaw = (50000 / 1024).toFixed(1)
      const expectedCompressed = (compressedSize / 1024).toFixed(1)
      expect(result).toBe(` (${expectedRaw} KB original, ~${expectedCompressed} KB compressed)`)
    })
  })

  test('formats MB for large files', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const content = 'a'.repeat(2 * 1024 * 1024)
      const filePath = joinPath(tmpDir, 'bundle.js')
      await writeFile(filePath, content)
      const compressedSize = (await deflateAsync(Buffer.from(content))).byteLength

      // When
      const result = await formatBundleSize(filePath)

      // Then
      const expectedRaw = (Buffer.byteLength(content) / (1024 * 1024)).toFixed(2)
      const expectedCompressed = (compressedSize / 1024).toFixed(1)
      expect(result).toBe(` (${expectedRaw} MB original, ~${expectedCompressed} KB compressed)`)
    })
  })

  test('returns empty string on error', async () => {
    // When
    const result = await formatBundleSize('/missing/path.js')

    // Then
    expect(result).toBe('')
  })
})
