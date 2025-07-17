/**
 * Extracts the content of a given Liquid tag.
 *
 * This function is designed for high-throughput, runtime asset compilation in
 * large Shopify theme assets.
 *
 * All theme pages require locally-built compiled JavaScript and CSS files, so
 * extraction must be extremely fast. Previously, `@shopify/liquid-html-parser`
 * was used, but while is more robust and accurate approach parse times
 * exceeded 1ms per file (in local benchmarks), which is prohibitive for large
 * themes:
 *
 * file size: 0.29 KB   - parse time: 1.38ms
 * file size: 0.35 KB   - parse time: 1.44ms
 * file size: 6.37 KB   - parse time: 26.16ms
 * file size: 11.72 KB  - parse time: 33.33ms
 * file size: 21.15 KB  - parse time: 70.30ms
 * file size: 134.66 KB - parse time: 258.89ms
 * file size: 250.00 KB - parse time: 506.89ms
 *
 * This function adopts the regular expression approach, keeping extraction
 * well under ~1ms per file, which is crucial for developer experience and
 * runtime performance.
 *
 * @param liquid - The full Liquid template as a string.
 * @param tag - The Liquid tag to extract content from.
 *
 * @returns The tag content, or undefined if not found.
 */
export function getLiquidTagContent(liquid: string, tag: 'javascript' | 'stylesheet' | 'schema'): string | undefined {
  const openTagRE = new RegExp(`{%-?\\s*${tag}\\s*-?%}`)
  const closeTagRE = new RegExp(`{%-?\\s*end${tag}\\s*-?%}`)

  const openMatch = openTagRE.exec(liquid)

  if (!openMatch) {
    return
  }

  const startIndex = openMatch.index + openMatch[0].length
  const closeMatch = closeTagRE.exec(liquid)

  if (!closeMatch) {
    return
  }

  const endIndex = closeMatch.index

  if (startIndex > endIndex) {
    return
  }

  return liquid.slice(startIndex, endIndex)
}
