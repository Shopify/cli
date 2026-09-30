import type {Issue} from '../types.js'
import type {ScanContext} from './types.js'

const JAVASCRIPT_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'])

interface ExpiringOfflineTokenScanResult {
  issues: Issue[]
  unresolvedReason?: string
  inspectedFiles: string[]
}

/**
 * Verify the supported React Router setup rather than interpreting offline
 * sessions (`isOnline: false`) as permanent tokens. Expiring offline tokens
 * still use offline sessions; the feature flag and refresh metadata are the
 * relevant signals.
 */
export function scanExpiringOfflineTokens(context: ScanContext): ExpiringOfflineTokenScanResult {
  const inspectedFiles = context.sourceFiles.filter((file) => file.content !== undefined).map((file) => file.path)
  const setupFiles = context.sourceFiles.filter(
    (file) =>
      file.content &&
      JAVASCRIPT_EXTENSIONS.has(file.ext) &&
      /\bshopifyApp\s*\(/.test(stripCommentsAndStrings(file.content)),
  )
  if (setupFiles.length === 0)
    return {
      issues: [],
      inspectedFiles,
      unresolvedReason:
        'No React Router shopifyApp(...) setup was found, so offline-token expiry could not be verified.',
    }

  const setupSource = setupFiles.map((file) => stripCommentsAndStrings(file.content!)).join('\n')
  if (/\bexpiringOfflineAccessTokens\s*:\s*false\b/.test(setupSource)) {
    const file = setupFiles.find((candidate) =>
      /\bexpiringOfflineAccessTokens\s*:\s*false\b/.test(stripCommentsAndStrings(candidate.content!)),
    )!
    const index = stripCommentsAndStrings(file.content!).search(/\bexpiringOfflineAccessTokens\s*:\s*false\b/)
    return {issues: [makeIssue(file.path, lineAt(file.content!, index))], inspectedFiles}
  }

  if (!/\bexpiringOfflineAccessTokens\s*:\s*true\b/.test(setupSource))
    return {
      issues: [],
      inspectedFiles,
      unresolvedReason:
        'expiringOfflineAccessTokens: true was not found in the React Router setup. The value may be absent or computed and needs review.',
    }

  if (!/\bsessionStorage\s*:/.test(setupSource))
    return {
      issues: [],
      inspectedFiles,
      unresolvedReason:
        'Expiring offline tokens are enabled, but the configured session storage could not be identified.',
    }

  if (!sessionStorageSupportsRefreshMetadata(context, setupSource))
    return {
      issues: [],
      inspectedFiles,
      unresolvedReason:
        'Expiring offline tokens are enabled, but session storage compatibility with expires/refreshToken/refreshTokenExpires metadata could not be verified.',
    }

  return {issues: [], inspectedFiles}
}

function sessionStorageSupportsRefreshMetadata(context: ScanContext, setupSource: string): boolean {
  // These adapters serialize complete Session objects instead of projecting a
  // fixed relational schema, so refresh fields are retained without a schema migration.
  if (/\bnew\s+(?:Memory|Redis|MongoDB|SQLite)SessionStorage\s*\(/.test(setupSource)) return true

  if (/\bnew\s+PrismaSessionStorage\s*\(/.test(setupSource)) {
    return context.sourceFiles.some((file) => {
      if (file.ext !== '.prisma' || !file.content) return false
      const sessionModel = /\bmodel\s+Session\s*\{([^}]*)\}/.exec(file.content)?.[1]
      return Boolean(
        sessionModel &&
        /\bexpires\s+DateTime\?/.test(sessionModel) &&
        /\brefreshToken\s+String\?/.test(sessionModel) &&
        /\brefreshTokenExpires\s+DateTime\?/.test(sessionModel),
      )
    })
  }

  // A custom store is only considered compatible when its implementation
  // visibly persists all metadata required to refresh and rotate the token.
  return context.sourceFiles.some(
    (file) =>
      file.content &&
      /\brefreshToken\b/.test(file.content) &&
      /\brefreshTokenExpires\b/.test(file.content) &&
      /\bexpires\b/.test(file.content) &&
      /\b(?:storeSession|sessionStorage|SessionStorage)\b/.test(file.content),
  )
}

function stripCommentsAndStrings(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '')
    .replace(/(["'`])(?:\\.|(?!\1)[^\\\n])*\1/g, (literal) => literal.replace(/[^\n]/g, ' '))
}

function lineAt(source: string, index: number): number {
  return source.slice(0, Math.max(0, index)).split('\n').length
}

function makeIssue(file: string, line: number): Issue {
  return {
    id: 'EXPIRING_OFFLINE_TOKEN',
    severity: 'medium',
    points: -10,
    title: 'Expiring offline access tokens explicitly disabled',
    message: 'The React Router Shopify app setup explicitly sets expiringOfflineAccessTokens to false.',
    location: {file, line},
    fix: {
      automated: false,
      description: 'Enable expiring offline access tokens and ensure session storage persists refresh metadata.',
      guide: 'https://shopify.dev/docs/apps/build/authentication-authorization/access-token-types/online-access-tokens',
    },
  }
}
