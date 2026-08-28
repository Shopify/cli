import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'

/**
 * Rule: METAFIELD_OFFLINE_TOKEN (-15, high)
 *
 * Metafield writes (metafieldsSet) should use online session tokens,
 * not offline tokens. Online tokens are user-scoped and expire, which
 * means the write is attributable to a specific user session. Offline
 * tokens are shop-scoped and permanent — a metafield write with an
 * offline token has no user attribution and no expiry.
 *
 * This rule detects metafieldsSet calls that appear in the context of
 * unauthenticated.admin() — which uses offline tokens by definition.
 */

const RULE_ID = 'METAFIELD_OFFLINE_TOKEN'
const POINTS = -15
const SEVERITY: Issue['severity'] = 'high'
const TITLE = 'Metafield write using offline token context'

export function scanMetafieldOfflineToken(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []
  const seen = new Set<string>()

  for (const file of files) {
    if (!file.content) continue
    if (!['.js', '.ts', '.jsx', '.tsx', '.rb'].includes(file.ext)) continue

    const content = file.content

    // JS/TS: unauthenticated.admin(...) + metafieldsSet in same file
    if (['.js', '.ts', '.jsx', '.tsx'].includes(file.ext)) {
      const hasUnauthAdmin = /unauthenticated\.admin\s*\(/.test(content)
      const hasMetafieldWrite = /metafields?Set|metafields?\/.*(?:POST|PUT|create|update)/i.test(content)

      if (hasUnauthAdmin && hasMetafieldWrite) {
        const key = file.path
        if (seen.has(key)) continue
        seen.add(key)
        issues.push({
          id: RULE_ID,
          severity: SEVERITY,
          points: POINTS,
          title: TITLE,
          message: `metafieldsSet is called in a file that also uses unauthenticated.admin() — metafield writes should use online session tokens (authenticate.admin), not offline tokens (unauthenticated.admin).`,
          location: {file: file.path},
          fix: {
            automated: false,
            description:
              'Use authenticate.admin(request) instead of unauthenticated.admin() for metafield writes. Online tokens provide user attribution and expiry.',
            guide:
              'https://shopify.dev/docs/apps/build/authentication-authorization/access-token-types/online-access-tokens',
          },
          confidence: 'needs_review',
        })
      }
    }

    // Ruby: ShopifyAPI::Context with is_embedded but using offline sessions
    if (file.ext === '.rb') {
      const hasMetafieldWrite = /metafield.*(?:create|update|save|set)/i.test(content)
      const hasOfflineOnly = /shop_session_repository/.test(content) && !/user_session_repository/.test(content)

      if (hasMetafieldWrite && hasOfflineOnly) {
        const key = file.path
        if (seen.has(key)) continue
        seen.add(key)
        issues.push({
          id: RULE_ID,
          severity: SEVERITY,
          points: POINTS,
          title: TITLE,
          message: `Metafield write in a Rails app that uses offline-only sessions (config.shop_session_repository without config.user_session_repository). Metafield writes should use online tokens.`,
          location: {file: file.path},
          fix: {
            automated: false,
            description: 'Add config.user_session_repository to enable online (user) sessions for metafield writes.',
            guide:
              'https://shopify.dev/docs/apps/build/authentication-authorization/access-token-types/online-access-tokens',
          },
          confidence: 'needs_review',
        })
      }
    }
  }

  return issues
}

/**
 * Rule: MISSING_EMBEDDED_CSP (-10, high)
 *
 * Embedded Shopify apps must set a Content-Security-Policy frame-ancestors
 * directive. Without it, any origin can iframe the app — a clickjacking risk.
 * The existing STATIC_FRAME_ANCESTORS rule catches wildcards; this rule
 * catches the *absence* of any frame-ancestors in an embedded app.
 */

const CSP_RULE_ID = 'MISSING_EMBEDDED_CSP'
const CSP_POINTS = -10
const CSP_SEVERITY: Issue['severity'] = 'high'
const CSP_TITLE = 'Embedded app missing frame-ancestors CSP directive'

export function scanMissingEmbeddedCsp(files: SourceFile[], isEmbedded: boolean): Issue[] {
  // This check only applies to embedded apps.
  if (!isEmbedded) return []

  const issues: Issue[] = []

  for (const file of files) {
    if (!file.content) continue
    if (!['.js', '.ts', '.jsx', '.tsx'].includes(file.ext)) continue

    // Look for document response header setup (where CSP would be set)
    const hasResponseHeaders =
      /addDocumentResponseHeaders|Content-Security-Policy|frame-ancestors|documentResponseHeaders/i.test(file.content)

    // If this file sets up response headers but doesn't mention frame-ancestors
    if (hasResponseHeaders && !/frame-ancestors/i.test(file.content)) {
      issues.push({
        id: CSP_RULE_ID,
        severity: CSP_SEVERITY,
        points: CSP_POINTS,
        title: CSP_TITLE,
        message: `This embedded app sets document response headers but does not include a frame-ancestors directive. Without frame-ancestors, any origin can iframe the app — a clickjacking risk.`,
        location: {file: file.path},
        fix: {
          automated: false,
          description:
            "Add frame-ancestors to your CSP, restricted to the authenticated shop domain and admin.shopify.com. Use Shopify App Remix's addDocumentResponseHeaders for automatic handling.",
          guide: 'https://shopify.dev/docs/apps/build/security/set-up-iframe-protection',
        },
        confidence: 'needs_review',
      })
    }
  }

  return issues
}
