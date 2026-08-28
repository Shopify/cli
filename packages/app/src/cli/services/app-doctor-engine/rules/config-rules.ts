import {readFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {Issue} from '../types.js'
import type {Rule, ScanContext} from './types.js'

// ---------------------------------------------------------------------------
// Scope declaration sites
//
// Scopes are not only declared in shopify.app.toml. Server-side SDKs declare
// them in their own config files. A deprecated or over-requested scope is
// equally dangerous wherever it is declared, so every known site must be
// checked.
// ---------------------------------------------------------------------------

export interface ScopeDeclarationSite {
  label: string
  /** Paths relative to the app root. */
  files: string[]
  /** Must capture the comma/space-separated scope list in group 1. */
  pattern: RegExp
}

export const SCOPE_DECLARATION_SITES: ScopeDeclarationSite[] = [
  {
    label: 'app configuration',
    files: ['shopify.app.toml'],
    // TOML scopes are a quoted string. Commas or spaces can separate entries.
    pattern: /^[ \t]*scopes[ \t]*=[ \t]*"([^"]*)"/m,
  },
  {
    label: 'shopify_app initializer',
    files: ['config/initializers/shopify_app.rb'],
    // Ruby: config.scope = "read_products, write_script_tags"
    // Anchored to line start so commented-out declarations do not match.
    pattern: /^[ \t]*config\.scope[ \t]*=[ \t]*["']([^"']*)["']/m,
  },
]

export interface ScopeDeclaration {
  label: string
  /** Path relative to the app root. */
  file: string
  scopes: string[]
}

/**
 * Collect declared scopes from every known declaration site present in the app.
 * Splitting on both commas and whitespace handles both valid TOML conventions.
 */
export function collectScopeDeclarations(appRoot: string): ScopeDeclaration[] {
  const declarations: ScopeDeclaration[] = []

  for (const site of SCOPE_DECLARATION_SITES) {
    for (const file of site.files) {
      let content: string
      try {
        content = readFileSync(joinPath(appRoot, file)).toString()
        // A missing declaration site isn't an error.
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch {
        continue
      }
      const match = content.match(site.pattern)
      if (!match?.[1]) continue
      const scopes = match[1]
        .split(/[\s,]+/)
        .map((scope) => scope.trim())
        .filter(Boolean)
      if (scopes.length > 0) {
        declarations.push({label: site.label, file, scopes})
      }
    }
  }

  return declarations
}

/** Parse a scopes string (comma or space separated) into individual scope names. */
export function parseScopes(scopes: string): string[] {
  return scopes
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean)
}

/** Rule 1: DEPRECATED_SCRIPT_TAG_SCOPE (-30, critical) */
export const deprecatedScriptTagScope: Rule = {
  id: 'DEPRECATED_SCRIPT_TAG_SCOPE',
  title: 'Using deprecated write_script_tags scope',
  severity: 'critical',
  points: -30,
  check(ctx: ScanContext): Issue[] {
    const declarations = collectScopeDeclarations(ctx.appRoot)
    const issues: Issue[] = []
    const seen = new Set<string>()

    for (const decl of declarations) {
      for (const scope of decl.scopes) {
        if (scope !== 'write_script_tags' && scope !== 'read_script_tags') continue
        // Same scope declared in two places is one problem, not two.
        if (seen.has(scope)) continue
        seen.add(scope)

        issues.push({
          id: this.id,
          severity: this.severity,
          points: this.points,
          title: this.title,
          message: `Scope "${scope}" is deprecated (declared in ${decl.label}). Apps should use app embeds (theme app extensions) instead of the Script Tag API.`,
          location: {file: decl.file},
          fix: {
            automated: false,
            description: `Remove "${scope}" from scopes and migrate to app embeds`,
            guide: 'https://shopify.dev/docs/apps/online-store/app-embeds',
          },
        })
      }
    }
    return issues
  },
}

/** Rule 2: SCOPE_OVER_REQUEST (-12, high) — heuristic: declared scopes not referenced in code */
export const scopeOverRequest: Rule = {
  id: 'SCOPE_OVER_REQUEST',
  title: 'OAuth scope may be over-requested',
  severity: 'high',
  points: -12,
  check(ctx: ScanContext): Issue[] {
    const declarations = collectScopeDeclarations(ctx.appRoot)
    if (declarations.length === 0) return []

    // De-duplicate scopes across declaration sites.
    const allScopes = [...new Set(declarations.flatMap((declaration) => declaration.scopes))]

    // Combine all source file content for searching.
    const searchableFiles = ctx.sourceFiles.filter((file) => (file.content ?? '').length > 0)
    const allContent = searchableFiles.map((file) => file.content ?? '').join('\n')

    // This rule infers "unused" from the absence of a reference in the code.
    // With no code to search, that inference is vacuous — every declared scope
    // would be reported as unused. Config-only zones (a shopify.app.toml with
    // the implementation living elsewhere) hit this and produced one false
    // positive per declared scope. Stay silent rather than guess.
    if (searchableFiles.length === 0) return []

    const issues: Issue[] = []
    for (const scope of allScopes) {
      // Skip scopes that are commonly used implicitly.
      if (['read_products', 'write_products'].includes(scope)) continue

      // Check if scope (or its root concept) appears in code.
      const scopeRoot = scope.replace(/^(?:read|write)_/, '').replace(/s$/, '')
      const searchTerms = [scope, scopeRoot]
      const found = searchTerms.some((term) => new RegExp(term.replace(/_/g, '[_]?'), 'i').test(allContent))
      if (!found) {
        // Report against the first declaration site that contains this scope.
        const decl = declarations.find((declaration) => declaration.scopes.includes(scope))
        issues.push({
          id: this.id,
          severity: this.severity,
          points: this.points,
          title: this.title,
          message: `Scope "${scope}" is declared but not referenced in the app code. It may be over-requested.`,
          location: {file: decl?.file ?? 'shopify.app.toml'},
          fix: {
            automated: false,
            description: `Remove "${scope}" from scopes if not needed, or add code that uses it`,
            guide: 'https://shopify.dev/docs/api/usage/access-scopes',
          },
          confidence: 'needs_review',
        })
      }
    }
    return issues
  },
}

/** Rule 7: INSECURE_WEBHOOK_URL (-12, high) */
export const insecureWebhookUrl: Rule = {
  id: 'INSECURE_WEBHOOK_URL',
  title: 'Webhook URL is not HTTPS',
  severity: 'high',
  points: -12,
  requires: 'webhooks',
  check(ctx: ScanContext): Issue[] {
    if (!ctx.appToml?.webhooks) return []

    const issues: Issue[] = []
    for (const sub of ctx.appToml.webhooks) {
      // Relative URIs are fine (they resolve to the app URL)
      if (sub.uri.startsWith('/')) continue
      if (!sub.uri.startsWith('https://')) {
        issues.push({
          id: this.id,
          severity: this.severity,
          points: this.points,
          title: this.title,
          message: `Webhook URI "${sub.uri}" is not HTTPS. Webhook endpoints must use HTTPS.`,
          location: {file: relativePath(ctx.appToml.path, ctx.appRoot)},
          fix: {
            automated: false,
            description: 'Change the webhook URI to use https://',
            guide: 'https://shopify.dev/docs/apps/webhooks',
          },
        })
      }
    }
    return issues
  },
}

/** Rule 11: MISSING_IP_ALLOWLIST (-10, high) */
export const missingIpAllowlist: Rule = {
  id: 'MISSING_IP_ALLOWLIST',
  title: 'No IP address spaces declared in app config',
  severity: 'high',
  points: -10,
  check(ctx: ScanContext): Issue[] {
    if (!ctx.appToml) return []

    const allowlist = ctx.appToml.ip_allowlist
    if (!allowlist || allowlist.length === 0) {
      return [
        {
          id: this.id,
          severity: this.severity,
          points: this.points,
          title: this.title,
          message:
            'No IP address ranges are declared in shopify.app.toml. Declaring IP spaces improves security by restricting where API requests can originate.',
          location: {file: relativePath(ctx.appToml.path, ctx.appRoot)},
          fix: {
            automated: false,
            description: 'Add an [ip_allowlist] section to shopify.app.toml with your server IP ranges',
            guide: 'https://shopify.dev/docs/apps/launch/security-review#ip-allowlisting',
          },
        },
      ]
    }

    // Check for open allowlist
    if (allowlist.includes('0.0.0.0/0') || allowlist.includes('::/0')) {
      return [
        {
          id: this.id,
          severity: this.severity,
          points: this.points,
          title: 'IP allowlist is open to all addresses',
          message:
            'The IP allowlist contains 0.0.0.0/0, which allows requests from any IP. Restrict to your server IP ranges.',
          location: {file: relativePath(ctx.appToml.path, ctx.appRoot)},
          fix: {
            automated: false,
            description: 'Remove 0.0.0.0/0 and add specific IP ranges',
          },
        },
      ]
    }

    return []
  },
}

function relativePath(fullPath: string, appRoot: string): string {
  return fullPath.replace(`${appRoot}/`, '').replace(appRoot, '')
}
