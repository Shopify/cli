import {readFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'

/**
 * Rule: EXPIRING_OFFLINE_TOKEN (-20, high)
 *
 * Shopify is requiring apps to migrate from permanent offline access tokens
 * to online tokens (which expire and must be refreshed). The deadline is
 * January 1, 2026. As of August 2026, adoption was at ~40%.
 *
 * This rule detects apps that have not opted into the migration:
 *
 * - Remix/JS: `shopifyApp()` config without `expiringOfflineAccessTokens: true`
 *   in the `future` flags, or explicit `isOnline: false`
 * - Rails: `config.shop_session_repository` set but `config.user_session_repository`
 *   NOT set (offline-only, no user-level online sessions)
 * - Any app: `isOnline: false` in authentication setup
 */

const RULE_ID = 'EXPIRING_OFFLINE_TOKEN'
const POINTS = -20
const SEVERITY: Issue['severity'] = 'high'
const TITLE = 'Expiring offline access tokens not enabled'

export function scanExpiringOfflineTokens(sourceFiles: SourceFile[], appRoot: string): Issue[] {
  const issues: Issue[] = []
  // Deduplicate issues by file.
  const seen = new Set<string>()

  for (const file of sourceFiles) {
    if (!file.content) continue

    // --- Remix / JS / TS: shopifyApp() config ---
    if (['.ts', '.tsx', '.js', '.jsx'].includes(file.ext)) {
      // Check if this file sets up shopifyApp()
      if (!/shopifyApp\s*\(/.test(file.content)) continue

      // If they explicitly set expiringOfflineAccessTokens: true, they're compliant
      if (/expiringOfflineAccessTokens\s*:\s*true/.test(file.content)) continue

      // If they explicitly set isOnline: false, that's a clear violation
      const isOnlineFalse = /isOnline\s*:\s*false/.test(file.content)

      // If they have the future flag but it's false or not set to true
      const hasFutureFlags = /future\s*:/.test(file.content)
      const hasExpiringFlag = /expiringOfflineAccessTokens/.test(file.content)

      if (isOnlineFalse) {
        issues.push(
          makeIssue(file.path, `Explicit isOnline: false in ${file.path} — app uses permanent offline tokens`),
        )
      } else if (hasFutureFlags && !hasExpiringFlag) {
        issues.push(
          makeIssue(
            file.path,
            `shopifyApp() config has future flags but does not enable expiringOfflineAccessTokens: true`,
          ),
        )
      } else if (!hasFutureFlags) {
        issues.push(
          makeIssue(
            file.path,
            `shopifyApp() config does not set future.expiringOfflineAccessTokens: true — app may be using permanent offline tokens`,
          ),
        )
      }
    }

    // --- Rails: shopify_app.rb initializer ---
    if (file.ext === '.rb' && /shopify_app/i.test(file.path)) {
      // Strip Ruby comments (lines starting with #) before checking
      const activeLines = file.content
        .split('\n')
        .filter((line) => !/^\s*#/.test(line))
        .join('\n')
      const hasShopSession = /config\.shop_session_repository\s*=/.test(activeLines)
      const hasUserSession = /config\.user_session_repository\s*=/.test(activeLines)

      // Offline-only: has shop session but no user session
      if (hasShopSession && !hasUserSession) {
        issues.push(
          makeIssue(
            file.path,
            `Rails app uses config.shop_session_repository without config.user_session_repository — offline tokens only, no online (user) sessions`,
          ),
        )
      }
    }
  }

  // Also check shopify.app.toml for access mode hints
  try {
    const tomlPath = joinPath(appRoot, 'shopify.app.toml')
    const toml = readFileSync(tomlPath).toString()
    // Some apps declare access_mode in the TOML
    if (/access_mode\s*=\s*["']offline["']/i.test(toml)) {
      issues.push(
        makeIssue(
          'shopify.app.toml',
          'shopify.app.toml declares access_mode = "offline" — migrate to online tokens before Jan 1, 2026',
        ),
      )
    }
    // Missing or unreadable TOML files are handled by source-file discovery.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // Nothing else to do.
  }

  // Dedup by file
  return issues.filter((issue) => {
    const key = issue.location.file
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  function makeIssue(file: string, message: string): Issue {
    return {
      id: RULE_ID,
      severity: SEVERITY,
      points: POINTS,
      title: TITLE,
      message,
      location: {file},
      fix: {
        automated: false,
        description:
          'Enable expiring offline access tokens: set future.expiringOfflineAccessTokens: true in shopifyApp() config (Remix) or add config.user_session_repository (Rails). See https://shopify.dev/docs/apps/build/authentication-authorization/access-token-types/online-access-tokens',
        guide:
          'https://shopify.dev/docs/apps/build/authentication-authorization/access-token-types/online-access-tokens',
      },
    }
  }
}
