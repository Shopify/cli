import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'

/**
 * Rule: APP_PROXY_LIQUID_INJECTION (-25, critical)
 *
 * When an app proxy endpoint responds with content-type "application/liquid",
 * Shopify renders the response body as Liquid on the merchant's storefront.
 * If the response body includes user input (query params, form data, request
 * body), this is server-side template injection — an attacker can inject
 * Liquid tags that execute on the merchant's store.
 *
 * This is one of the most Shopify-specific vulnerabilities that exists.
 * No generic scanner knows about app proxies or application/liquid.
 *
 * Detection:
 * 1. Find files that set content_type to "application/liquid"
 * 2. In the same file, check if request params are interpolated into the
 *    response body (render text:, render inline:, res.send with params)
 * 3. If both conditions are met → flag as definite
 * 4. If application/liquid is used but no param interpolation is visible
 *    → flag as needs_review (the endpoint exists, review manually)
 */

const RULE_ID = 'APP_PROXY_LIQUID_INJECTION'
const POINTS = -25
const SEVERITY: Issue['severity'] = 'critical'
const TITLE = 'App proxy Liquid injection risk'

export function scanAppProxyLiquidInjection(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []

  for (const file of files) {
    if (!file.content) continue
    if (!['.js', '.ts', '.jsx', '.tsx', '.rb'].includes(file.ext)) continue

    const content = file.content

    // Check if this file uses application/liquid content type
    const hasLiquidContentType = /application\/liquid/i.test(content)
    if (!hasLiquidContentType) continue

    // Check if request params are interpolated into response bodies
    // Ruby: params[:xxx] in render text:, ERB templates
    // JS/TS: req.query, req.params, request.url in res.send/render
    const hasParamInterpolation =
      // Ruby patterns
      /params\[/.test(content) ||
      /params\./.test(content) ||
      // JS/TS patterns
      /req\.query/.test(content) ||
      /req\.params/.test(content) ||
      /request\.url/.test(content) ||
      /searchParams\.get/.test(content) ||
      // Liquid variable interpolation in strings
      /\{\{.*params/.test(content)

    // Check if the response actually uses the params in a rendered body
    // (not just reading them for logging or validation)
    const rendersWithParams =
      // Ruby: render text: "...#{params[:xxx]}..."
      /render\s+(?:text:|inline:).*params\[/s.test(content) ||
      // Ruby: ERB with params
      /<%=.*params\[/s.test(content) ||
      // JS: res.send(`...${req.query.xxx}...`)
      /res\.(send|json|end)\s*\(.*req\.(query|params|body)/s.test(content) ||
      // JS: response.body with params
      /response\.body.*req\.(query|params)/s.test(content) ||
      // Generic: any string interpolation containing params and render/send
      /(render|send|write|body).*params/s.test(content)

    if (rendersWithParams) {
      issues.push({
        id: RULE_ID,
        severity: SEVERITY,
        points: POINTS,
        title: TITLE,
        message: `App proxy endpoint responds with content-type "application/liquid" and interpolates request parameters into the response. Shopify will render this as Liquid on the merchant's storefront — an attacker can inject Liquid tags that execute on the store. Never interpolate user input into application/liquid responses.`,
        location: {file: file.path},
        fix: {
          automated: false,
          description:
            "Don't interpolate request parameters into application/liquid responses. Use application/json for data responses, or escape all user input before rendering as Liquid.",
          guide: 'https://shopify.dev/docs/apps/online-store/app-proxies',
        },
      })
    } else if (hasParamInterpolation) {
      // application/liquid + params read but not clearly rendered → needs_review
      issues.push({
        id: RULE_ID,
        severity: SEVERITY,
        points: POINTS,
        title: TITLE,
        message: `App proxy endpoint responds with content-type "application/liquid" and reads request parameters. Review manually to ensure no user input is interpolated into the Liquid response — this would be server-side template injection.`,
        location: {file: file.path},
        fix: {
          automated: false,
          description:
            'Verify that request parameters are not interpolated into the application/liquid response body. Use "application/json" for data, or escape all user input.',
          guide: 'https://shopify.dev/docs/apps/online-store/app-proxies',
        },
        confidence: 'needs_review',
      })
    }
    // If application/liquid is used but no params at all → don't flag
    // (the endpoint renders static Liquid, which is safe)
  }

  return issues
}
