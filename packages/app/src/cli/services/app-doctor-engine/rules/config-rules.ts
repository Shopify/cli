import {relativePath} from '@shopify/cli-kit/node/path'
import type {Issue} from '../types.js'
import type {Rule, ScanContext} from './types.js'

/** Parse a scopes string (comma or space separated) into individual scope names. */
function parseScopes(scopes: string): string[] {
  return scopes
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean)
}

/** Deprecated ScriptTag capability in parsed Shopify configuration. */
export const deprecatedScriptTagScope: Rule = {
  id: 'DEPRECATED_SCRIPT_TAG_SCOPE',
  title: 'Deprecated ScriptTag capability',
  severity: 'medium',
  points: -10,
  check(ctx: ScanContext): Issue[] {
    return ctx.appTomls.flatMap((configuration) => {
      const deprecatedScopes = parseScopes(configuration.scopes ?? '').filter(
        (scope) => scope === 'write_script_tags' || scope === 'read_script_tags',
      )
      return deprecatedScopes.map(
        (scope): Issue => ({
          id: this.id,
          severity: 'medium',
          points: -10,
          title: this.title,
          message: `Scope "${scope}" is deprecated. Apps should use app embeds instead of the ScriptTag API.`,
          location: {file: relativePath(ctx.appRoot, configuration.path).replace(/\\/g, '/')},
          fix: {
            automated: false,
            description: `Remove "${scope}" from scopes and migrate to app embeds`,
            guide: 'https://shopify.dev/docs/apps/online-store/app-embeds',
          },
        }),
      )
    })
  },
}

/** Rule 7: INSECURE_WEBHOOK_URL (-12, high) */
export const insecureWebhookUrl: Rule = {
  id: 'INSECURE_WEBHOOK_URL',
  title: 'Webhook URL is not HTTPS',
  severity: 'high',
  points: -12,
  check(ctx: ScanContext): Issue[] {
    const issues: Issue[] = []
    for (const configuration of ctx.appTomls) {
      const values = [
        ...configuration.webhooks.map((subscription) => ({kind: 'Webhook URI', value: subscription.uri})),
        ...configuration.redirectUrls.map((value) => ({kind: 'OAuth redirect URI', value})),
      ]
      for (const {kind, value} of values) {
        if (isSafeConfiguredUrl(value, kind === 'Webhook URI')) continue
        issues.push({
          id: this.id,
          severity: this.severity,
          points: this.points,
          title: this.title,
          message: `${kind} is not a conservative secure URL. Use a Shopify-relative path or an HTTPS URL with an exact host and path.`,
          location: {file: relativePath(ctx.appRoot, configuration.path).replace(/\\/g, '/')},
          fix: {
            automated: false,
            description: 'Use an HTTPS URL with an exact host and path, or a Shopify-relative path where supported.',
            guide: 'https://shopify.dev/docs/apps/webhooks',
          },
        })
      }
    }
    return issues
  },
}

function isSafeConfiguredUrl(value: string, webhook: boolean): boolean {
  if (/^\/(?!\/)[^\s*]*$/.test(value)) return true
  if (webhook && /^(?:pubsub|eventbridge):\/\/[^\s*]+$/i.test(value)) return true
  if (webhook && /^arn:aws:events:[a-z0-9-]+:\d*:event-source\/[^\s*]+$/i.test(value)) return true
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !url.hostname || url.hostname.includes('*')) return false
    if (url.username || url.password || url.hash) return false
    return url.pathname.startsWith('/') && !url.pathname.includes('*')
    // URL construction is intentionally validation: malformed input is unsafe.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}
