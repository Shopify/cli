# Experiment 8: Pre-compile RegExp patterns in getLiquidTagContent

## Hypothesis
Pre-compiling the 6 RegExp patterns (open/close for javascript, stylesheet, schema) at module level will eliminate repeated RegExp object creation in the high-throughput `getLiquidTagContent` function.

The function comment explicitly states it's designed for "high-throughput, runtime asset compilation" where "extraction must be extremely fast." Currently it creates 2 new RegExp objects per call, but there are only 3 possible tag values.

## Approach
1. Create a `TAG_PATTERNS` map at module level with pre-compiled RegExp for each tag
2. Look up the compiled patterns by tag name instead of creating new RegExp objects

## Code Changes

Edit `/Users/joshuafaigan/src/github.com/Shopify/cli/packages/theme/src/cli/utilities/theme-environment/liquid-tag-content.ts`:

Replace the entire file content with:

```typescript
/**
 * Pre-compiled RegExp patterns for Liquid tag extraction.
 * Patterns are compiled once at module load for maximum throughput.
 */
const TAG_PATTERNS = {
  javascript: {
    open: /{%-?\s*javascript\s*-?%}/,
    close: /{%-?\s*endjavascript\s*-?%}/,
  },
  stylesheet: {
    open: /{%-?\s*stylesheet\s*-?%}/,
    close: /{%-?\s*endstylesheet\s*-?%}/,
  },
  schema: {
    open: /{%-?\s*schema\s*-?%}/,
    close: /{%-?\s*endschema\s*-?%}/,
  },
} as const

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
  const patterns = TAG_PATTERNS[tag]

  const openMatch = patterns.open.exec(liquid)
  if (!openMatch) {
    return
  }

  const startIndex = openMatch.index + openMatch[0].length

  const closeMatch = patterns.close.exec(liquid)
  if (!closeMatch) {
    return
  }

  const endIndex = closeMatch.index

  return liquid.slice(startIndex, endIndex)
}
```

## Success Criteria
- All 561 tests pass
- Type checking passes
- RegExp patterns compiled once at module init vs twice per function call
