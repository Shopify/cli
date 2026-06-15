import {readFile} from '@shopify/cli-kit/node/fs'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {deflate} from 'node:zlib'
import {promisify} from 'node:util'

const deflateAsync = promisify(deflate)

/**
 * Computes the raw and compressed (deflate) size of a file.
 * Uses the same compression algorithm as the Shopify backend (Zlib::Deflate.deflate).
 */
export async function getBundleSize(filePath: string) {
  const content = await readFile(filePath)
  const rawBytes = Buffer.byteLength(content)
  const compressed = await deflateAsync(Buffer.from(content))
  const compressedBytes = compressed.byteLength

  return {path: filePath, rawBytes, compressedBytes}
}

/**
 * Formats a byte count as a human-readable string (KB or MB).
 */
function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }
  return `${(bytes / 1024).toFixed(1)} KB`
}

/**
 * Returns a formatted bundle size suffix like " (21.4 KB original, ~8.3 KB compressed)".
 * Returns an empty string on failure so callers can append it unconditionally.
 */
export async function formatBundleSize(filePath: string) {
  try {
    const {rawBytes, compressedBytes} = await getBundleSize(filePath)
    return ` (${formatSize(rawBytes)} original, ~${formatSize(compressedBytes)} compressed)`
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputDebug(`Failed to get bundle size for ${filePath}: ${error}`)
    return ''
  }
}
