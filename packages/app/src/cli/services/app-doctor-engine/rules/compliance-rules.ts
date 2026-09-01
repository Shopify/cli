import {relativePath} from '@shopify/cli-kit/node/path'
import type {Issue} from '../types.js'
import type {ScanContext, Rule, SourceFile} from './types.js'

const MANDATORY_TOPICS = ['shop/redact', 'customers/data_request', 'customers/redact']
const QUARTERLY_MONTHS = new Map([
  ['January', '01'],
  ['April', '04'],
  ['July', '07'],
  ['October', '10'],
])

/** Mandatory compliance subscriptions must be present in every deployable app configuration. */
export const missingComplianceWebhooks: Rule = {
  id: 'MISSING_COMPLIANCE_WEBHOOKS',
  title: 'Missing mandatory GDPR compliance webhooks',
  severity: 'medium',
  points: -10,
  check(context: ScanContext): Issue[] {
    return context.appTomls.flatMap((configuration) => {
      const declaredTopics = new Set(configuration.webhooks.flatMap((subscription) => subscription.topics))
      const missingTopics = MANDATORY_TOPICS.filter((topic) => !declaredTopics.has(topic))
      if (missingTopics.length === 0) return []
      return [
        {
          id: this.id,
          severity: this.severity,
          points: this.points,
          title: this.title,
          message: `Missing mandatory compliance webhooks: ${missingTopics.join(', ')}.`,
          location: {file: relativePath(context.appRoot, configuration.path).replace(/\\/g, '/')},
          fix: {
            automated: false,
            description: 'Add subscriptions for all three mandatory compliance topics.',
            guide: 'https://shopify.dev/docs/apps/webhooks/configuration/mandatory-webhooks',
          },
        } satisfies Issue,
      ]
    })
  },
}

/**
 * Shopify stable API versions have a 12-month support window. We allow a
 * deliberately small 30-day operational grace period after that date because
 * Shopify can briefly extend a version during a migration. The clock is an
 * argument so boundary behavior is deterministic in tests.
 */
export function isEolApiVersion(version: string, referenceDate: Date, graceDays = 30): boolean {
  const match = /^(\d{4})-(01|04|07|10)$/.exec(version)
  if (!match) return false
  const release = Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)
  const supportEnd = Date.UTC(Number(match[1]) + 1, Number(match[2]) - 1, 1)
  const graceEnd = supportEnd + graceDays * 24 * 60 * 60 * 1000
  return release <= referenceDate.getTime() && referenceDate.getTime() >= graceEnd
}

/** Inspect every parsed app TOML plus high-signal React Router server declarations. */
export function scanEolApiVersions(context: ScanContext, referenceDate = new Date()): Issue[] {
  const configIssues = context.appTomls.flatMap((configuration) => {
    if (!configuration.apiVersion || !isEolApiVersion(configuration.apiVersion, referenceDate)) return []
    return [
      makeEolIssue(relativePath(context.appRoot, configuration.path).replace(/\\/g, '/'), configuration.apiVersion),
    ]
  })

  if (context.detection.framework !== 'react_router') return configIssues
  const sourceIssues = context.sourceFiles.flatMap((file) => scanReactRouterApiVersion(file, referenceDate))
  return [...configIssues, ...sourceIssues]
}

function scanReactRouterApiVersion(file: SourceFile, referenceDate: Date): Issue[] {
  if (!file.content || !/^app\/shopify\.server\.[cm]?[jt]sx?$/.test(file.path)) return []
  const content = maskStringsExceptVersions(stripComments(file.content))
  const declarations = [
    ...content.matchAll(/\bapiVersion\s*:\s*["'](\d{4}-(?:01|04|07|10))["']/g),
    ...content.matchAll(/\bapiVersion\s*:\s*ApiVersion\.(January|April|July|October)(\d{2}|\d{4})\b/g),
  ]
  return declarations.flatMap((match) => {
    const version = match[1]?.includes('-') ? match[1] : enumApiVersion(match[1]!, match[2]!)
    if (!version || !isEolApiVersion(version, referenceDate)) return []
    return [makeEolIssue(file.path, version, lineAt(file.content!, match.index ?? 0))]
  })
}

function enumApiVersion(monthName: string, yearText: string): string | undefined {
  const month = QUARTERLY_MONTHS.get(monthName)
  if (!month) return undefined
  const year = yearText.length === 2 ? `20${yearText}` : yearText
  return `${year}-${month}`
}

function makeEolIssue(file: string, version: string, line?: number): Issue {
  return {
    id: 'EOL_API_VERSION',
    severity: 'low',
    points: -5,
    title: 'End-of-life API version',
    message: `API version ${version} is past its 12-month support window and 30-day extension grace period.`,
    location: {file, ...(line === undefined ? {} : {line})},
    fix: {
      automated: false,
      description: 'Select a currently supported Shopify API version.',
      guide: 'https://shopify.dev/docs/api/usage/versioning',
    },
  }
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, '')
}

function maskStringsExceptVersions(source: string): string {
  return source.replace(/(["'])(?:\\.|(?!\1)[^\\\n])*\1|`(?:\\.|[^`])*`/g, (literal) =>
    /^["']\d{4}-(?:01|04|07|10)["']$/.test(literal) ? literal : literal.replace(/[^\n]/g, ' '),
  )
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split('\n').length
}
