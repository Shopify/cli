import {readFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {Issue} from '../types.js'
import type {ScanContext, Rule, SourceFile} from './types.js'

/**
 * Rule: MISSING_COMPLIANCE_WEBHOOKS (-15, high)
 *
 * Every public Shopify app must implement three mandatory compliance webhooks:
 *   - shop/redact        (GDPR right to erasure — delete shop data)
 *   - customers/data_request (GDPR data portability)
 *   - customers/redact   (GDPR right to erasure — delete customer data)
 *
 * These are App Store submission requirements. Missing them means the app
 * will be rejected during review. The doctor should catch this before
 * the developer submits.
 *
 * This rule checks the shopify.app.toml for declared webhook subscriptions
 * and flags any of the three mandatory topics that are missing.
 */

const MANDATORY_TOPICS = ['shop/redact', 'customers/data_request', 'customers/redact']

export const missingComplianceWebhooks: Rule = {
  id: 'MISSING_COMPLIANCE_WEBHOOKS',
  title: 'Missing mandatory GDPR compliance webhooks',
  severity: 'high',
  points: -15,
  requires: 'webhooks',
  check(ctx: ScanContext): Issue[] {
    if (!ctx.appToml?.webhooks) return []

    const declaredTopics = new Set(ctx.appToml.webhooks.flatMap((sub) => sub.topics))

    const missing = MANDATORY_TOPICS.filter((t) => !declaredTopics.has(t))

    if (missing.length === 0) return []

    return [
      {
        id: this.id,
        severity: this.severity,
        points: this.points,
        title: this.title,
        message: `Missing mandatory compliance webhook${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. These are required for all public apps (GDPR right to erasure and data portability). Add them to the [webhooks] section of shopify.app.toml.`,
        location: {file: 'shopify.app.toml'},
        fix: {
          automated: false,
          description: `Add the following webhook subscriptions to shopify.app.toml:\n${missing.map((t) => `  [[webhooks.subscriptions]]\n  topics = ["${t}"]\n  uri = "/webhooks/${t.replace('/', '_')}"`).join('\n')}`,
          guide: 'https://shopify.dev/docs/apps/webhooks/configuration/mandatory-webhooks',
        },
      },
    ]
  },
}

/**
 * Rule: EOL_API_VERSION (-10, medium)
 *
 * Shopify releases quarterly API versions. Each is stable for ~12 months,
 * then deprecated. Versions older than ~24 months from the latest release
 * are end-of-life or deprecation-imminent. Apps on EOL versions miss
 * security fixes and will eventually break.
 *
 * This rule checks the api_version declared in shopify.app.toml and
 * the ApiVersion enum used in shopify.server.ts (Remix apps).
 */

// Shopify API versions in reverse chronological order.
// The latest is 2025-10 (October 2025). Versions older than
// 24 months from the latest are considered EOL.
const SUPPORTED_API_VERSIONS = [
  '2025-10',
  '2025-07',
  '2025-04',
  '2025-01',
  '2024-10',
  '2024-07',
  '2024-04',
  '2024-01',
  '2023-10',
  '2023-07',
  '2023-04',
  '2023-01',
]

// The cutoff: versions older than this are EOL.
// 2023-10 is ~24 months before 2025-10. Anything older is flagged.
const EOL_CUTOFF = '2023-10'

// Map ApiVersion enum names to version strings.
const API_VERSION_ENUM_MAP: Record<string, string> = {
  October25: '2025-10',
  July25: '2025-07',
  April25: '2025-04',
  January25: '2025-01',
  October24: '2024-10',
  July24: '2024-07',
  April24: '2024-04',
  January24: '2024-01',
  October23: '2023-10',
  July23: '2023-07',
  April23: '2023-04',
  January23: '2023-01',
}

function isEol(version: string): boolean {
  const index = SUPPORTED_API_VERSIONS.indexOf(version)
  // Unknown versions are definitely old or invalid.
  if (index === -1) return true
  const cutoffIndex = SUPPORTED_API_VERSIONS.indexOf(EOL_CUTOFF)
  // Entries further down the list are older.
  return index > cutoffIndex
}

export function scanEolApiVersion(sourceFiles: SourceFile[], appRoot: string): Issue[] {
  const issues: Issue[] = []
  const seen = new Set<string>()

  // 1. Check shopify.app.toml for api_version
  try {
    const toml = readFileSync(joinPath(appRoot, 'shopify.app.toml')).toString()
    const match = toml.match(/api_version\s*=\s*["']([^"']+)["']/)
    if (match?.[1] && isEol(match[1])) {
      issues.push({
        id: 'EOL_API_VERSION',
        severity: 'medium',
        points: -10,
        title: 'End-of-life API version',
        message: `API version ${match[1]} is end-of-life or deprecation-imminent. Update to a current version (2024-10 or newer) to get security fixes and avoid breaking changes.`,
        location: {file: 'shopify.app.toml'},
        fix: {
          automated: false,
          description: `Update api_version in shopify.app.toml to a current version (e.g., "2025-10"). Also update the ApiVersion enum in shopify.server.ts if using Remix.`,
          guide: 'https://shopify.dev/docs/api/usage/versioning',
        },
      })
    }
    // Missing or unreadable TOML files are handled by source-file discovery.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // Nothing else to do.
  }

  // 2. Check shopify.server.ts for ApiVersion enum (Remix apps)
  for (const file of sourceFiles) {
    if (!file.content) continue
    if (!['shopify.server.ts', 'shopify.server.js'].some((filename) => file.path.endsWith(filename))) continue

    const enumMatch = file.content.match(/ApiVersion\.(\w+)/g)
    if (!enumMatch) continue

    for (const match of enumMatch) {
      const enumName = match.replace('ApiVersion.', '')
      const version = API_VERSION_ENUM_MAP[enumName]
      if (!version) continue
      if (isEol(version) && !seen.has(file.path)) {
        seen.add(file.path)
        issues.push({
          id: 'EOL_API_VERSION',
          severity: 'medium',
          points: -10,
          title: 'End-of-life API version',
          message: `ApiVersion.${enumName} (${version}) is end-of-life or deprecation-imminent. Update to a current version to get security fixes and avoid breaking changes.`,
          location: {file: file.path},
          fix: {
            automated: false,
            description: `Update ApiVersion.${enumName} to a current version (e.g., ApiVersion.October25) in ${file.path}.`,
            guide: 'https://shopify.dev/docs/api/usage/versioning',
          },
        })
      }
    }
  }

  return issues
}
