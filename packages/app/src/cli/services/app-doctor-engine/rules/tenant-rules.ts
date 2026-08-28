import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'

/**
 * Rule: MISSING_TENANT_ISOLATION (-20, high, needs_review)
 *
 * The most common real vulnerability class in Shopify apps: database
 * queries not scoped by shop. A Remix app doing
 * `prisma.order.findMany({ where: { id } })` without `shop` in the
 * where clause leaks data across tenants.
 *
 * This is inherently noisy — static analysis can't prove a query is
 * unscoped without understanding the full data model. So this rule is
 * always `needs_review` — it surfaces the pattern for human/agent review
 * but does not affect the score.
 *
 * Detection:
 * - Prisma: findMany/findFirst/findUnique with a where clause that
 *   doesn't reference shop/session
 * - Rails: Model.where(...) without shop_id or shop: in conditions
 * - Sequelize: findAll/findOne with where that doesn't reference shop
 *
 * Only scans files in authenticated route handlers ( loaders/actions in
 * Remix, controller actions in Rails) — public routes don't have a
 * shop context to scope by.
 */

const RULE_ID = 'MISSING_TENANT_ISOLATION'
const POINTS = -20
const SEVERITY: Issue['severity'] = 'high'
const TITLE = 'Database query may not be scoped by shop'

export function scanMissingTenantIsolation(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []
  const seen = new Set<string>()

  for (const file of files) {
    if (!file.content) continue
    if (!['.js', '.ts', '.jsx', '.tsx', '.rb'].includes(file.ext)) continue

    // Skip test files — test fixtures contain DB queries that aren't
    // real app code. Covers: *.test.*, *.spec.*, *_test.rb,
    // test/*, tests/*, __tests__/*, etc.
    if (
      /\b(test|spec|fixture|mock|__test)\b/i.test(file.path) ||
      /_test\.rb$/i.test(file.path) ||
      /\btests?\//.test(file.path)
    )
      continue

    const content = file.content

    // Only scan files that look like route handlers / controllers
    // (have authenticate or loader/action patterns)
    const isRouteHandler =
      /export\s+(?:async\s+)?(?:const|function)\s+(?:loader|action)\b/.test(content) ||
      /authenticate\.admin\s*\(/.test(content) ||
      (/class.*Controller/.test(content) && file.ext === '.rb')

    if (!isRouteHandler) continue

    // Skip internal controllers — same reasoning as lib/ skip:
    // auth lives at the route level (namespace :internal), not in the controller.
    if (/\binternal\//.test(file.path) || /\binternal_/.test(file.path)) continue

    const lines = content.split('\n')
    for (const [i, line] of lines.entries()) {
      const trimmed = line.trim()

      // Skip comments
      if (/^\s*(\/\/|#|\/\*|\*)/.test(trimmed)) continue

      // --- Prisma patterns (JS/TS) ---
      // findMany({ where: { id } }) — no shop in where
      if (/\.(findMany|findFirst|findUnique|findUniqueOrThrow)\s*\(/.test(trimmed)) {
        // Check next ~5 lines for the where clause (narrower window to avoid
        // picking up unrelated shop mentions in surrounding code)
        const context = lines.slice(i, i + 5).join('\n')
        // If the where clause doesn't mention shop, session, or shopId → flag
        if (/where\s*:/.test(context) && !/\bshop\b|shopId|shop_id|session\.shop|session\.domain/i.test(context)) {
          const key = `${file.path}:${i + 1}`
          if (seen.has(key)) continue
          seen.add(key)
          issues.push(makeIssue(file.path, i + 1, 'Prisma query without shop scope', trimmed))
        }
      }

      // --- Rails patterns (Ruby) ---
      // Model.where(...) without shop_id or shop: in conditions
      if (file.ext === '.rb') {
        // .where(condition) without shop_id
        if (/\.where\s*\(/.test(trimmed) && !/shop_id|shop\b.*:|current_shop|shopify_domain/i.test(trimmed)) {
          // Skip if it's a Shop model query itself
          if (/Shop\.where|shop\.where/i.test(trimmed)) continue
          const key = `${file.path}:${i + 1}`
          if (seen.has(key)) continue
          seen.add(key)
          issues.push(makeIssue(file.path, i + 1, 'Rails query without shop scope', trimmed))
        }
      }

      // --- Sequelize patterns (JS/TS) ---
      if (/\.findAll\s*\(/.test(trimmed) || /\.findOne\s*\(/.test(trimmed)) {
        const context = lines.slice(i, i + 10).join('\n')
        if (/where\s*:/.test(context) && !/\bshop\b|shopId|shop_id|session\.(shop|domain)/i.test(context)) {
          const key = `${file.path}:${i + 1}`
          if (seen.has(key)) continue
          seen.add(key)
          issues.push(makeIssue(file.path, i + 1, 'Sequelize query without shop scope', trimmed))
        }
      }
    }
  }

  return issues
}

function makeIssue(file: string, line: number, type: string, snippet: string): Issue {
  return {
    id: RULE_ID,
    severity: SEVERITY,
    points: POINTS,
    title: TITLE,
    message: `${type} in an authenticated route handler. The where clause does not reference the shop domain or session — this query may return data from other tenants. In a multi-tenant Shopify app, always scope database queries by the authenticated shop.`,
    location: {file, line},
    snippet: snippet.substring(0, 80),
    fix: {
      automated: false,
      description:
        "Add the authenticated shop to the query's where clause: where: { id, shop: session.shop } or where: { shop_id: current_shop.id }.",
      guide: 'https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens',
    },
    confidence: 'needs_review',
  }
}
