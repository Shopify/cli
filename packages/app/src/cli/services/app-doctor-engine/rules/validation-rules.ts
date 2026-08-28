import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'

/*
 * Rule: WEAK_SHOP_VALIDATION (-15, high)
 *
 * During OAuth, apps validate the `shop` parameter to ensure it's a
 * legitimate Shopify shop domain. A common vulnerability is using an
 * unanchored regex like /\.myshopify\.com/ which matches
 * "evil.com/x.myshopify.com" — allowing an attacker to redirect the
 * OAuth token to a server they control.
 *
 * This rule detects regex patterns that:
 * 1. Contain "myshopify.com" (not .io, not .dev — those are different domains)
 * 2. Are used in a validation context (not just any URL reference)
 * 3. Are NOT anchored (^ and $)
 *
 * To avoid false positives, we skip:
 * - Comments (//, #, /*)
 * - Lines that look like URLs in strings (http://...myshopify.com/...)
 * - Template interpolation ({shop}.myshopify.com)
 * - Import/export statements
 */

const RULE_ID = 'WEAK_SHOP_VALIDATION'
const POINTS = -15
const SEVERITY: Issue['severity'] = 'high'
const TITLE = 'Shop domain validation regex is not anchored'

export function scanWeakShopValidation(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []
  const seen = new Set<string>()

  for (const file of files) {
    if (!file.content) continue
    if (!['.js', '.ts', '.jsx', '.tsx', '.rb'].includes(file.ext)) continue

    // Skip test files — test fixtures contain myshopify.com in assertions,
    // not actual validation code. Covers: *.test.*, *.spec.*, *_test.rb,
    // test/*, tests/*, __tests__/*, *.test.tsx, etc.
    if (
      /\b(test|spec|fixture|mock|__test)\b/i.test(file.path) ||
      /_test\.rb$/i.test(file.path) ||
      /\btests?\//.test(file.path)
    )
      continue

    const lines = file.content.split('\n')
    for (const [i, line] of lines.entries()) {
      const trimmed = line.trim()

      // Skip comments
      if (/^\s*(\/\/|#|\/\*|\*)/.test(trimmed)) continue
      // Skip import/export/require lines
      if (/^\s*(import|export|require)\b/.test(trimmed)) continue
      // Skip lines that are just URLs in strings (http/https references)
      if (
        /https?:\/\/[^/]*myshopify\.com/i.test(trimmed) &&
        !/regex|RegExp|match|test\(|=~|valid|sanitize|check/i.test(trimmed)
      )
        continue
      // Skip template interpolation like `{shop}.myshopify.com`
      if (
        /\{.*\}.*myshopify\.com/i.test(trimmed) &&
        !/regex|RegExp|match|test\(|=~|valid|sanitize|check/i.test(trimmed)
      )
        continue

      // Only flag lines that have BOTH myshopify.com AND a validation context
      const hasValidationContext = /regex|RegExp|match|test\(|=~|valid|sanitize|check|verify|pattern/i.test(trimmed)
      if (!hasValidationContext) continue

      // Detect regex literals containing myshopify.com (not .io, not .dev)
      const regexMatch = line.match(/\/([^/]*myshopify[^/]*com[^/]*)\//)
      const regexPattern = regexMatch?.[1]
      if (regexPattern !== undefined && !isAnchored(regexPattern)) {
        const key = `${file.path}:${i + 1}`
        if (seen.has(key)) continue
        seen.add(key)
        issues.push(makeIssue(file.path, i + 1, regexPattern, trimmed))
      }

      // Detect new RegExp("...myshopify.com...") calls
      const newRegExpMatch = line.match(/new\s+RegExp\s*\(\s*["'`](.*?myshopify\.com.*?)["'`]/)
      const constructorPattern = newRegExpMatch?.[1]
      if (constructorPattern !== undefined && !isAnchored(constructorPattern)) {
        const key = `${file.path}:${i + 1}`
        if (seen.has(key)) continue
        seen.add(key)
        issues.push(makeIssue(file.path, i + 1, constructorPattern, trimmed))
      }
    }
  }

  return issues
}

function isAnchored(pattern: string): boolean {
  return /^\^/.test(pattern) && /\$[^/]*$/.test(pattern)
}

function makeIssue(file: string, line: number, pattern: string, snippet: string): Issue {
  return {
    id: RULE_ID,
    severity: SEVERITY,
    points: POINTS,
    title: TITLE,
    message: `Shop domain validation regex /${pattern}/ is not anchored. An unanchored regex matching "myshopify.com" can be exploited: "evil.com/x.myshopify.com" would pass validation, allowing token theft. Anchor with ^ and $.`,
    location: {file, line},
    snippet: snippet.substring(0, 80),
    fix: {
      automated: false,
      description:
        'Anchor the regex: /^[a-zA-Z0-9][a-zA-Z0-9-]*\\.myshopify\\.com$/ — the ^ and $ prevent prefix/suffix attacks.',
      guide: 'https://shopify.dev/docs/apps/build/authentication-authorization/get-access-tokens/oauth',
    },
  }
}
