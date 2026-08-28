import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'

/**
 * Rule: TOKEN_LEAKAGE (-20, high)
 *
 * Detects session tokens, access tokens, or API secrets being logged
 * via console.log, logger, or similar output. Leaking tokens in logs
 * is a common security incident — logs are often shipped to third-party
 * observability tools.
 */

export function scanTokenLeakage(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []

  const tokenPatterns = [
    /(?:access[_-]?token|session[_-]?token|api[_-]?secret|api[_-]?key|SHOPIFY_API_SECRET|SHOPIFY_ACCESS_TOKEN)\b/i,
  ]

  const sinkPatterns = [
    /\bconsole\.(log|info|warn|error|debug)\s*\(/,
    /\blogger\.(info|debug|warn|error|log)\s*\(/,
    /\bconsole\.dir\s*\(/,
  ]

  for (const file of files) {
    if (!file.content) continue
    if (!['.js', '.ts', '.jsx', '.tsx', '.rb', '.py'].includes(file.ext)) continue

    const lines = file.content.split('\n')
    for (const [i, line] of lines.entries()) {
      const isSink = sinkPatterns.some((pattern) => pattern.test(line))
      if (!isSink) continue

      // Check if the log call includes token-like variable names
      const hasTokenRef = tokenPatterns.some((pattern) => pattern.test(line))
      if (!hasTokenRef) continue

      // Skip if it's clearly a comment or a string that mentions tokens
      // but doesn't actually log them
      if (/^\s*\/\//.test(line) || /^\s*#/.test(line)) continue
      if (/["'].*token.*["']/.test(line) && !/[\w.]+\s*[),]/.test(line)) continue

      issues.push({
        id: 'TOKEN_LEAKAGE',
        severity: 'high',
        points: -20,
        title: 'Token or secret may be logged',
        message: `This log statement references a token or secret. Logging credentials exposes them in log files and observability tools. Remove the token from the log call or redact it.`,
        location: {file: file.path, line: i + 1},
        snippet: line.trim().substring(0, 80),
        fix: {
          automated: false,
          description:
            'Remove the token/secret from the log statement. If debugging is needed, log a redacted version or a boolean flag.',
        },
      })
    }
  }

  return issues
}

/**
 * Rule: OPEN_REDIRECT (-12, medium)
 *
 * Detects auth callback handlers that redirect to a URL taken from
 * request parameters without validation. This is a classic OAuth
 * vulnerability — an attacker can craft a URL that redirects the
 * merchant to a phishing site after auth.
 */

export function scanOpenRedirect(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []

  for (const file of files) {
    if (!file.content) continue
    if (!['.js', '.ts', '.jsx', '.tsx'].includes(file.ext)) continue

    const lines = file.content.split('\n')
    for (const [i, line] of lines.entries()) {
      // Pattern: redirect/searchParams.get("returnUrl") or redirect(req.query.redirect)
      // without validation
      const redirectFromParam =
        /\b(?:redirect|res\.redirect|Response\.redirect)\s*\(\s*(?:.*searchParams\.get|.*query\.|.*params\.|.*\.url)/i.test(
          line,
        )
      const hasValidation = /\b(?:if|validate|allowed|whitelist|allowlist|startsWith|includes|match)\b/i.test(
        lines.slice(i, i + 5).join('\n'),
      )

      if (redirectFromParam && !hasValidation) {
        issues.push({
          id: 'OPEN_REDIRECT',
          severity: 'medium',
          points: -12,
          title: 'Open redirect in auth callback',
          message: `Redirect target is taken from request parameters without validation. An attacker can redirect users to a phishing site after authentication. Validate the redirect URL against an allowlist.`,
          location: {file: file.path, line: i + 1},
          snippet: line.trim().substring(0, 80),
          fix: {
            automated: false,
            description:
              'Validate the redirect URL against an allowlist of permitted domains, or use a relative path only.',
            guide: 'https://shopify.dev/docs/apps/build/authentication-authorization',
          },
          confidence: 'needs_review',
        })
      }
    }
  }

  return issues
}
