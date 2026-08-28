import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'

/** Rule 12: UNAUTHENTICATED_ENDPOINT (-15, high) */
export function scanUnauthenticatedEndpoints(sourceFiles: SourceFile[]): Issue[] {
  const issues: Issue[] = []

  for (const file of sourceFiles) {
    if (!file.content) continue
    if (!['.js', '.ts', '.jsx', '.tsx', '.rb', '.php', '.py'].includes(file.ext)) continue

    const routes = findRoutes(file)
    for (const route of routes) {
      if (hasAuthPattern(file.content, route)) {
        // Auth exists — but check for the try/catch fallback pattern.
        const fallback = detectAuthFallbackToUserInput(file.content, route)
        if (fallback) {
          issues.push({
            id: 'UNAUTHENTICATED_ENDPOINT',
            severity: 'high',
            points: -15,
            title: 'Auth may be bypassed via catch-block fallback to user input',
            message: `This route has authentication (${fallback.authPattern}), but the catch block at line ${fallback.catchLine} falls back to using user input (${fallback.userInputPattern}) for data access. If auth fails, an attacker can control the shop identity via query params or request body — an IDOR vulnerability. Derive shop identity from the authenticated session, never from user input.`,
            location: {file: file.path, line: fallback.catchLine},
            snippet: fallback.snippet,
            fix: {
              automated: false,
              description:
                'Remove the catch-block fallback. If public access is needed, use a separate unauthenticated endpoint with explicit, limited data access — never trust user-supplied shop params.',
              guide: 'https://shopify.dev/docs/apps/auth/session-tokens',
            },
            confidence: 'needs_review',
          })
        }
        continue
      }

      // No auth at all — flag as unauthenticated.
      issues.push({
        id: 'UNAUTHENTICATED_ENDPOINT',
        severity: 'high',
        points: -15,
        title: 'Route handler with no recognized auth verification',
        message: `Route handler at line ${route.line} does not appear to have authentication verification. Ensure Shopify session validation (authenticate.admin or equivalent) is present. This is a "needs review" finding — verify your auth pattern is recognized.`,
        location: {file: file.path, line: route.line},
        snippet: route.snippet,
        fix: {
          automated: false,
          description:
            'Add session validation middleware (e.g., authenticate.admin for Remix, verify_request for Express, before_action for Rails)',
          guide: 'https://shopify.dev/docs/apps/auth',
        },
        confidence: 'needs_review',
      })
    }
  }

  return issues
}

interface RouteMatch {
  line: number
  snippet: string
  /** The function/method body that handles this route */
  handlerText: string
}

function findRoutes(file: SourceFile): RouteMatch[] {
  const routes: RouteMatch[] = []
  const content = file.content!
  const lines = content.split('\n')

  // Skip auth/login files — these are supposed to be unauthenticated
  if (/auth[._-]?(login|callback|start|begin)/i.test(file.path)) return routes
  // Skip index/homepage routes — public landing pages
  if (file.path.includes('_index') || file.path.includes('home')) return routes
  // Skip test/eval fixture routes — these are test infrastructure, not app endpoints
  if (/\b(test|eval|verdict|fixture|mock)\b/i.test(file.path)) return routes
  // Skip route config files — these declare routes but auth lives in controllers/middleware, not the route definition
  if (/\b(routes\.rb|routes\.php|urls\.py|routes\.js|routes\.ts)\b/i.test(file.path)) return routes
  // Skip files under lib/ — engine/service code, not direct app endpoints.
  // Shopify apps put their controllers in app/controllers/. Code in lib/ is
  // typically mounted inside a namespace (e.g. namespace :internal) whose
  // auth lives at the Rails route level, not inside the Sinatra/Rails controller.
  // Flagging these produces false positives we can't resolve from the file alone.
  if (/\blib\//.test(file.path)) return routes
  // Skip health/ping/status routes — these are infrastructure endpoints, not app endpoints
  // Check both filename AND route path content
  if (/\b(health|ping|status|ready|live)\b/i.test(file.path)) return routes
  if (content && /['"]\/(?:health|ping|status|ready|live|services\/ping)['"]/.test(content)) return routes

  if (file.ext === '.rb') {
    for (const [i, line] of lines.entries()) {
      if (/^\s*(?:get|post|put|delete|patch|match)\s+['"]/.test(line)) {
        routes.push({
          line: i + 1,
          snippet: line.trim(),
          handlerText: lines.slice(i, i + 10).join('\n'),
        })
      }
    }
  } else if (file.ext === '.php') {
    for (const [i, line] of lines.entries()) {
      if (/Route::(?:get|post|put|delete|patch)\s*\(/.test(line)) {
        routes.push({
          line: i + 1,
          snippet: line.trim(),
          handlerText: lines.slice(i, i + 20).join('\n'),
        })
      }
    }
  } else if (file.ext === '.py') {
    for (const [i, line] of lines.entries()) {
      if (/@(?:app|bp)\.route\s*\(/.test(line)) {
        routes.push({
          line: i + 1,
          snippet: line.trim(),
          handlerText: lines.slice(i, i + 20).join('\n'),
        })
      }
    }
  } else {
    for (const [i, line] of lines.entries()) {
      const expressMatch = line.match(/\b(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]*)['"`]/)
      if (expressMatch) {
        routes.push({
          line: i + 1,
          snippet: line.trim(),
          handlerText: lines.slice(i, i + 30).join('\n'),
        })
        continue
      }

      const remixMatch = line.match(/export\s+(?:async\s+)?(?:const|function)\s+(loader|action)\b/)
      if (remixMatch) {
        const endLine = Math.min(i + 50, lines.length)
        routes.push({
          line: i + 1,
          snippet: line.trim(),
          handlerText: lines.slice(i, endLine).join('\n'),
        })
      }
    }
  }

  return routes
}

/**
 * Check if the route handler has recognized auth patterns.
 */
function hasAuthPattern(content: string, route: RouteMatch): boolean {
  const handlerText = route.handlerText

  if (hasDelegatedAuthHelper(content, handlerText)) return true
  if (/authenticate\.(admin|public|customer)\s*\(/.test(handlerText)) return true
  if (/\bauthenticate\.admin\b/.test(handlerText)) return true
  if (/\bawait\s+authenticate\b/.test(handlerText)) return true
  if (/verifyRequest|verify_request|requireAuth|require_auth/i.test(handlerText)) return true
  if (/shopify\.(auth|session)/i.test(handlerText)) return true
  if (/before_action\s+:.*(?:verify|auth|shopify)/i.test(handlerText)) return true
  if (/authenticate_shop!?|current_shopify_shop|current_shop/i.test(handlerText)) return true
  if (/verify_shopify/i.test(handlerText)) return true
  if (/middleware\s*\(\s*['"]auth/i.test(handlerText)) return true
  if (/\$this->middleware\s*\(/i.test(handlerText)) return true
  if (/@login_required|current_user/is.test(handlerText)) return true
  if (/login_required/.test(handlerText)) return true
  if (
    /session\s*===?\s*null|!session|session\??\.user|isAuthenticated|verifyToken|verifyHmac|hmac\s*===?\s*/i.test(
      handlerText,
    )
  )
    return true
  if (/from\s+['"][^'"]*shopify\.server['"]/.test(content) && /authenticate/.test(handlerText)) return true
  if (/verifyWebhook|verify_webhook|validateWebhook|hmac\s*===?\s*computed/i.test(handlerText)) return true
  // Remix/Express webhook verification patterns.
  if (/authenticate\.webhook\s*\(/.test(handlerText)) return true
  if (/createHmac|crypto\.createHmac/.test(handlerText)) return true
  if (/timingSafeEqual|timing_safe_equal/.test(handlerText)) return true
  if (/verifyHmacSignature|verify_hmac_signature/.test(handlerText)) return true

  return false
}

function hasDelegatedAuthHelper(content: string, handlerText: string): boolean {
  const helperCallPattern = /\b([A-Za-z_$][\w$]*)\s*\(/g
  let helperCallMatch = helperCallPattern.exec(handlerText)
  while (helperCallMatch !== null) {
    const helperName = helperCallMatch[1]
    if (helperName && !['json', 'redirect', 'Response', 'URL'].includes(helperName)) {
      const escapedHelperName = helperName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const helperDefinitionPattern = new RegExp(
        `(?:async\\s+function\\s+${escapedHelperName}\\b|(?:const|let|var)\\s+${escapedHelperName}\\s*=)[\\s\\S]{0,1200}authenticate\\.(?:admin|public|customer)\\s*\\(`,
      )
      if (helperDefinitionPattern.test(content)) return true
    }
    helperCallMatch = helperCallPattern.exec(handlerText)
  }
  return false
}

interface AuthFallback {
  authPattern: string
  catchLine: number
  userInputPattern: string
  snippet: string
}

/*
 * Detect the try/catch fallback pattern:
 *
 *   try {
 *     const { session } = await authenticate.admin(request);
 *   } catch (error) {
 *     const shop = url.searchParams.get("shop");  // user input trusted
 *   }
 *
 * If auth fails, the attacker controls which shop's data gets returned.
 */
function detectAuthFallbackToUserInput(content: string, route: RouteMatch): AuthFallback | null {
  const lines = content.split('\n')
  const handlerLines = lines.slice(route.line - 1, route.line - 1 + 60)

  const authMatch = handlerLines.join('\n').match(/authenticate\.(admin|public|customer)\s*\(/)
  const authPattern = authMatch?.[1] === undefined ? 'authenticate' : `authenticate.${authMatch[1]}`

  for (const [i, line] of handlerLines.entries()) {
    if (/^\s*\}\s*catch\s*\(/.test(line) || /^\s*catch\s*\(/.test(line)) {
      const catchLine = route.line + i

      let braceDepth = 1
      const catchBody: string[] = []
      for (const bodyLine of handlerLines.slice(i + 1)) {
        if (braceDepth <= 0) break
        catchBody.push(bodyLine)
        for (const ch of bodyLine) {
          if (ch === '{') braceDepth++
          if (ch === '}') braceDepth--
        }
      }

      const catchText = catchBody.join('\n')

      const userInputPatterns = [
        {
          pattern: /(?:url\.)?searchParams\.get\s*\(\s*["']shop["']/i,
          label: 'searchParams.get("shop")',
        },
        {
          pattern: /(?:url\.)?searchParams\.get\s*\(/i,
          label: 'searchParams.get()',
        },
        {
          pattern: /(?:req|request)\.body(?:\.shop|\.shopDomain|\.domain)?/i,
          label: 'request.body',
        },
        {
          pattern: /(?:req|request)\.query(?:\.shop|\.shopDomain)?/i,
          label: 'request.query',
        },
        {pattern: /params\.shop/i, label: 'params.shop'},
        {
          pattern: /(?:request|req)\.headers\[?["']shop/i,
          label: 'request.headers["shop"]',
        },
      ]

      for (const {pattern, label} of userInputPatterns) {
        if (pattern.test(catchText)) {
          const inputLine = catchBody.find((candidate) => pattern.test(candidate))
          const snippet = inputLine?.trim() ?? line.trim()
          return {authPattern, catchLine, userInputPattern: label, snippet}
        }
      }
    }
  }

  return null
}
