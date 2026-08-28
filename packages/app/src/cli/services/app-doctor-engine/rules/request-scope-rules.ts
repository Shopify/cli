import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'

/**
 * Rule: REQUEST_DERIVED_SHOP_SCOPE (-15, high, needs_review)
 *
 * A query that IS scoped by shop, but whose shop value comes from request
 * input rather than the authenticated session:
 *
 *     Token.where(shop_id: params[:shop_id]).delete_all
 *     Token.find_by(shop_id: params[:shop_id], app: app_type)
 *
 * MISSING_TENANT_ISOLATION checks whether a shop key is *present*. That
 * treats the presence of `shop_id:` as proof of scoping, so these queries
 * pass silently — but an attacker controls the value, which makes the scope
 * worthless. Presence of a tenant key is not the same as trustworthy
 * provenance, and this rule covers the gap.
 *
 * Always `needs_review`: a compensating control is often present but not
 * visible here. Flow, for example, guards these paths with an HMAC +
 * timestamp check declared in a parent controller. Static analysis cannot
 * follow that inheritance, so the finding is surfaced for a human or agent
 * to confirm rather than scored.
 *
 * Queries against the Shop model itself are excluded. Looking a shop up by
 * a request-supplied domain is the normal OAuth install path; the risk is
 * using a request-supplied shop to read or mutate *other* models' rows.
 */

const RULE_ID = 'REQUEST_DERIVED_SHOP_SCOPE'
const POINTS = -15
const SEVERITY: Issue['severity'] = 'high'
const TITLE = 'Query scoped by shop value taken from request input'

/** Ruby finder methods that accept keyword conditions. */
const RUBY_FINDERS = /\.(where|find_by!?|find_or_create_by!?|find_or_initialize_by|delete_by|destroy_by|exists\?)\s*\(/

/** Keys that carry tenant identity. */
const SHOP_KEY = /\b(shop_id|shopify_domain|shop_domain|shop)\s*:/

/** Request-controlled sources in Rails. */
const RUBY_REQUEST_SOURCE = /\b(?:request\.)?params\s*\[|\bparams\.fetch\s*\(/

/** Request-controlled sources in JS/TS. */
const JS_REQUEST_SOURCE = /\b(?:req|request)\.(?:query|body|params)\b|\bsearchParams\.get\s*\(|\bformData\.get\s*\(/

/** Model names that are the tenant record itself, not tenant-owned data. */
const SHOP_MODEL = /\b(?:::)?Shops?\s*\.\s*(?:where|find_by!?|find_or_create_by!?|exists\?)/

/**
 * Ruby locals are method-scoped, so request bindings must be too.
 *
 * A file-global map produces false positives: Flow assigns
 * `shop_id = params[:shop_id]` in one method, and an unrelated method later
 * takes `shop_id` as a *parameter*. Treating those as the same variable
 * flagged a safe call site. Bindings are therefore collected per `def`, and
 * a name in the method's own parameter list shadows any outer binding.
 *
 * Returns, for each line, the set of request-bound names visible at it.
 */
function collectRequestBoundLocalsByLine(lines: string[]): Set<string>[] {
  const perLine: Set<string>[] = []
  // Instance variables (@shop) survive across methods within a request, so
  // they are tracked at file scope; plain locals reset at each `def`.
  const instanceScope = new Set<string>()
  let methodScope = new Set<string>()

  for (const line of lines) {
    const defMatch = /^\s*def\s+[\w.]+\s*\(?([^)]*)\)?/.exec(line)
    const parameters = defMatch?.[1]
    if (parameters !== undefined) {
      methodScope = new Set<string>()
      // Parameters shadow outer bindings and are not request-bound here.
      for (const raw of parameters.split(',')) {
        const name = raw
          .trim()
          .replace(/[:*&].*$/, '')
          .replace(/\s*=.*$/, '')
          .trim()
        if (name) methodScope.delete(name)
      }
    }

    const assignment = /^\s*(@?[a-z_][a-zA-Z0-9_]*)\s*(?:\|\|)?=\s*(.+)$/.exec(line)
    if (assignment) {
      const [, name, value] = assignment
      if (name !== undefined && value !== undefined) {
        const fromRequest = RUBY_REQUEST_SOURCE.test(value) || JS_REQUEST_SOURCE.test(value)
        const target = name.startsWith('@') ? instanceScope : methodScope
        if (fromRequest) target.add(name)
        // Reassignment from a trusted value clears the taint.
        else target.delete(name)
      }
    }

    perLine.push(new Set([...instanceScope, ...methodScope]))
  }

  return perLine
}

export function scanRequestDerivedShopScope(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []
  const seen = new Set<string>()

  for (const file of files) {
    if (!file.content) continue
    if (!['.rb', '.js', '.ts', '.jsx', '.tsx'].includes(file.ext)) continue

    // Test fixtures legitimately construct queries from arbitrary input.
    if (
      /\b(test|spec|fixture|mock|__test)\b/i.test(file.path) ||
      /_test\.rb$/i.test(file.path) ||
      /\btests?\//.test(file.path)
    ) {
      continue
    }

    const content = file.content
    const isHandler =
      (/class\s+\w*Controller/.test(content) && file.ext === '.rb') ||
      /export\s+(?:async\s+)?(?:const|function)\s+(?:loader|action)\b/.test(content) ||
      /authenticate\.admin\s*\(/.test(content)
    if (!isHandler) continue

    const lines = content.split('\n')
    const boundByLine = collectRequestBoundLocalsByLine(lines)

    for (const [i, line] of lines.entries()) {
      const trimmed = line.trim()
      if (/^\s*(\/\/|#|\/\*|\*)/.test(trimmed)) continue
      if (!RUBY_FINDERS.test(trimmed) && !/\.(findMany|findFirst|findUnique|findAll|findOne)\s*\(/.test(trimmed)) {
        continue
      }
      if (!SHOP_KEY.test(trimmed)) continue
      // Looking up the tenant record itself is the normal install path.
      if (SHOP_MODEL.test(trimmed)) continue

      // The shop key's value must itself come from request input.
      const shopValue = /\b(?:shop_id|shopify_domain|shop_domain|shop)\s*:\s*([^,)\]}]+)/.exec(trimmed)
      const valueExpression = shopValue?.[1]?.trim()
      if (valueExpression === undefined) continue

      const direct = RUBY_REQUEST_SOURCE.test(valueExpression) || JS_REQUEST_SOURCE.test(valueExpression)
      const visible = boundByLine[i] ?? new Set<string>()
      const viaLocal = [...visible].some((name) =>
        new RegExp(`^${name.replace(/[@$]/g, '\\$&')}\\b`).test(valueExpression),
      )
      if (!direct && !viaLocal) continue

      const key = `${file.path}:${i + 1}`
      if (seen.has(key)) continue
      seen.add(key)

      issues.push({
        id: RULE_ID,
        severity: SEVERITY,
        points: POINTS,
        title: TITLE,
        message:
          `The shop scope on this query is taken from request input (${valueExpression}) rather than the ` +
          `authenticated session. A caller can substitute another shop's identifier and reach that tenant's rows. ` +
          `If a signature or session check guards this path, confirm it covers this action.`,
        location: {file: file.path, line: i + 1},
        snippet: trimmed.substring(0, 120),
        fix: {
          automated: false,
          description:
            'Scope the query with the shop from the authenticated session (current_shop / session.shop). ' +
            'If the endpoint must accept a shop parameter, verify it against a signed session or HMAC first.',
          guide: 'https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens',
        },
        confidence: 'needs_review',
      })
    }
  }

  return issues
}
