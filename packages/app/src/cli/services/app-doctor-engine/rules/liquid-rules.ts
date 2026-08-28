import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'

/** Rule 5: LIQUID_UNSAFE_RENDER (-25, critical) */
export function scanLiquidUnsafeRender(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []

  for (const file of files) {
    if (!file.content) continue
    if (file.ext !== '.liquid') continue

    const lines = file.content.split('\n')
    for (const [i, line] of lines.entries()) {
      // Match {{ ... | raw }} — the raw filter outputs unescaped HTML
      // Also catch {{ ... | raw | ... }} if raw is in the filter chain
      const rawMatches = matchLiquidRaw(line, i, lines)
      for (const match of rawMatches) {
        // Check if the variable is a metafield or user-generated content
        const isMetafield = /metafield|custom\.|description|content|body|review|comment/i.test(match.expression)

        issues.push({
          id: 'LIQUID_UNSAFE_RENDER',
          severity: 'critical',
          points: -25,
          title: 'Unsafe Liquid rendering with | raw filter',
          message: isMetafield
            ? `The | raw filter renders unescaped HTML from "${match.expression}". Metafield or user-generated content rendered with raw is an XSS vulnerability. Use | escape instead.`
            : `The | raw filter renders unescaped HTML from "${match.expression}". Use | escape to sanitize output.`,
          location: {file: file.path, line: i + 1},
          snippet: line.trim(),
          fix: {
            automated: false,
            description: 'Replace | raw with | escape',
            guide: 'https://shopify.dev/docs/api/liquid/filters/raw',
          },
        })
      }
    }
  }

  return issues
}

interface LiquidMatch {
  expression: string
  lineIndex: number
}

/*
 * Match Liquid raw-filter patterns.
 * Handles single-line and multi-line expressions.
 */
function matchLiquidRaw(line: string, lineIndex: number, _allLines: string[]): LiquidMatch[] {
  const matches: LiquidMatch[] = []

  // Single-line: {{ expression | raw }}
  const singleLineRegex = /\{\{\{?\s*([^}|]+?)(?:\s*\|\s*raw)\s*\}?\}\}/g
  let match
  while ((match = singleLineRegex.exec(line)) !== null) {
    const expression = match[1]
    if (expression !== undefined) matches.push({expression: expression.trim(), lineIndex})
  }

  // Also match | raw anywhere in the output tag, even with other filters
  // {{ expression | some_filter | raw }}
  const chainRegex = /\{\{\{?\s*([^}]+?\|[^}]+?\|[^}]*?raw[^}]*?)\s*\}?\}\}/g
  while ((match = chainRegex.exec(line)) !== null) {
    // Extract the main variable (first part before any |)
    const expression = match[1]
    const variable = expression?.split('|')[0]
    if (variable !== undefined) matches.push({expression: variable.trim(), lineIndex})
  }

  return matches
}

/** Rule 3: MISSING_SRI (-15, high) — detects external scripts without integrity. */
export function scanMissingSRI(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []

  for (const file of files) {
    if (!file.content) continue
    if (file.ext !== '.liquid' && file.ext !== '.html') continue

    const lines = file.content.split('\n')
    for (const [i, line] of lines.entries()) {
      // Match <script src="https://...">
      const scriptRegex = /<script\s+[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi
      let match
      while ((match = scriptRegex.exec(line)) !== null) {
        const src = match[1]
        // Only flag external URLs (http/https), not Shopify asset URLs
        if (src === undefined || !src.startsWith('http')) continue
        if (isShopifyDomain(src)) continue

        // Check if the tag has integrity attribute (may be on the same or next line)
        const fullTag = getFullScriptTag(lines, i, match.index)
        if (!fullTag.includes('integrity=')) {
          issues.push({
            id: 'MISSING_SRI',
            severity: 'high',
            points: -15,
            title: 'Missing subresource integrity on external script',
            message: `External script "${src}" has no integrity attribute. Add integrity="sha384-..." to prevent supply chain attacks.`,
            location: {file: file.path, line: i + 1},
            snippet: line.trim(),
            fix: {
              automated: false,
              description: 'Add integrity and crossorigin attributes to the script tag',
              guide: 'https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity',
            },
          })
        }
      }
    }
  }

  return issues
}

/** Rule 6: EXTERNAL_CDN_DEPENDENCY (-7, medium) — external CDN references in extension assets */
export function scanExternalCdn(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []

  const knownCdns = ['unpkg.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'ajax.googleapis.com']

  for (const file of files) {
    if (!file.content) continue
    if (
      file.ext !== '.liquid' &&
      file.ext !== '.js' &&
      file.ext !== '.ts' &&
      file.ext !== '.jsx' &&
      file.ext !== '.tsx'
    )
      continue

    const lines = file.content.split('\n')
    for (const [i, line] of lines.entries()) {
      for (const cdn of knownCdns) {
        if (line.includes(cdn)) {
          // Skip if this line has an integrity attribute — the script is
          // pinned, so the CDN supply-chain risk is mitigated.
          const fullTag = getFullScriptTag(lines, i, line.indexOf(cdn))
          if (fullTag.includes('integrity=')) continue

          issues.push({
            id: 'EXTERNAL_CDN_DEPENDENCY',
            severity: 'medium',
            points: -7,
            title: 'External CDN dependency',
            message: `Reference to ${cdn} detected. External CDN dependencies are a supply chain risk. Bundle the dependency or self-host it.`,
            location: {file: file.path, line: i + 1},
            snippet: line.trim(),
            fix: {
              automated: false,
              description: 'Bundle the dependency locally or self-host it',
            },
          })
        }
      }

      // Also flag fetch() to non-Shopify external domains
      const fetchMatch = line.match(/fetch\s*\(\s*['"`](https?:\/\/[^'"`]+)['"`]/)
      const url = fetchMatch?.[1]
      if (url !== undefined) {
        if (!isShopifyDomain(url)) {
          issues.push({
            id: 'EXTERNAL_CDN_DEPENDENCY',
            severity: 'medium',
            points: -7,
            title: 'External fetch to non-Shopify domain',
            message: `fetch() to external domain "${url}". Ensure this is necessary and the endpoint is trusted.`,
            location: {file: file.path, line: i + 1},
            snippet: line.trim(),
            fix: {
              automated: false,
              description: 'Proxy through Shopify App Proxy or declare the domain in extension config',
            },
          })
        }
      }
    }
  }

  return issues
}

function isShopifyDomain(url: string): boolean {
  return /(?:^|\.)(shopify\.com|shopifycdn\.com|myshopify\.com|shopifycloud\.com|shop\.dev)(?:$|\/)/.test(url)
}

/** Get the full <script> tag, handling multi-line tags */
function getFullScriptTag(lines: string[], startIndex: number, startOffset: number): string {
  let tag = lines[startIndex]?.slice(startOffset) ?? ''
  let lineIdx = startIndex
  while (!tag.includes('>') && lineIdx < lines.length - 1) {
    lineIdx++
    tag += `\n${lines[lineIdx] ?? ''}`
  }
  return tag
}
