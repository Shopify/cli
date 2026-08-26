import {getBundleSize, formatBundleSize} from './bundle-size.js'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {brotliCompress, constants as zlibConstants} from 'node:zlib'
import {promisify} from 'node:util'

const brotliCompressAsync = promisify(brotliCompress)

async function brotliSize(content: string) {
  const compressed = await brotliCompressAsync(Buffer.from(content), {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
    },
  })
  return compressed.byteLength
}

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
      expect(result.compressedBytes).toBe(await brotliSize(content))
      expect(result.compressedBytes).toBeLessThan(result.rawBytes)
    })
  })

  test('compressed size uses Brotli to match the backend size gate (Ruby Brotli.deflate)', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const content = JSON.stringify({key: 'value', nested: {array: [1, 2, 3]}})
      const filePath = joinPath(tmpDir, 'bundle.js')
      await writeFile(filePath, content)

      // When
      const result = await getBundleSize(filePath)

      // Then
      expect(result.compressedBytes).toBe(await brotliSize(content))
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
      const compressedSize = await brotliSize(content)

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
      const compressedSize = await brotliSize(content)

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
