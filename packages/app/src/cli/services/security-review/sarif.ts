import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {pathToFileURL} from '@shopify/cli-kit/node/fs'
import {relativePath} from '@shopify/cli-kit/node/path'
import type {AppSecurityReviewResult} from './types.js'

/**
 * `review --sarif`: the reviewed checks as a SARIF 2.1.0 log, the format that GitHub code scanning and other
 * scanners ingest. It's built from the public JSON result, so it shows what `--json` shows, in SARIF's terms. The
 * interfaces below are the subset of SARIF that the log uses.
 */

type AppSecurityCheck = AppSecurityReviewResult['checks'][number]
type AppSecurityFinding = AppSecurityCheck['findings'][number]
type AppSecurityLocation = AppSecurityFinding['location']
type AppSecurityGap = NonNullable<AppSecurityReviewResult['coverage']>['gaps'][number]
type Severity = AppSecurityCheck['severity']

type SarifLevel = 'error' | 'warning' | 'note'

interface SarifMessage {
  text: string
}

interface SarifPhysicalLocation {
  artifactLocation: {uri: string}
  region?: {startLine: number; startColumn?: number; snippet?: SarifMessage}
}

interface SarifRule {
  id: string
  shortDescription: SarifMessage
  fullDescription: SarifMessage
  help: SarifMessage
  helpUri?: string
  defaultConfiguration: {level: SarifLevel}
  properties: {tags: string[]; 'security-severity': string}
}

interface SarifResult {
  ruleId: string
  ruleIndex: number
  level: SarifLevel
  message: SarifMessage
  locations: {physicalLocation: SarifPhysicalLocation}[]
  relatedLocations?: {id: number; physicalLocation: SarifPhysicalLocation; message?: SarifMessage}[]
  properties: {source: AppSecurityFinding['source']; confidence?: string}
}

interface SarifNotification {
  level: SarifLevel
  message: SarifMessage
  /** The check's status, `no-result` for a check without results, the coverage gap's code, or `no-results-file`. */
  descriptor: {id: string}
  associatedRule?: {id: string; index: number}
  locations?: {physicalLocation: SarifPhysicalLocation}[]
}

export interface SarifLog {
  $schema: string
  version: '2.1.0'
  runs: {
    tool: {driver: {name: string; semanticVersion: string; informationUri: string; rules: SarifRule[]}}
    invocations: {executionSuccessful: boolean; toolExecutionNotifications: SarifNotification[]}[]
    automationDetails?: {id: string}
    columnKind: 'utf16CodeUnits'
    results: SarifResult[]
  }[]
}

const SARIF_SCHEMA = 'https://json.schemastore.org/sarif-2.1.0.json'

const LEVELS: Record<Severity, SarifLevel> = {high: 'error', medium: 'warning', low: 'note'}

/**
 * GitHub code scanning ranks security alerts by `security-severity`, a score out of 10: 7.0 to 8.9 is high, 4.0 to
 * 6.9 medium, and 0.1 to 3.9 low. Each check's severity maps into its own band.
 */
const SECURITY_SEVERITIES: Record<Severity, string> = {high: '8.0', medium: '5.0', low: '2.0'}

/**
 * The category of a run narrowed by `--check-id`: the sorted check IDs, so the same narrowing always gets the same
 * category, then the app's client ID when it has one, so the narrowed runs of two apps in one repository stay apart.
 * GitHub code scanning replaces the previous analysis of a category on each upload and closes the alerts missing from
 * it as fixed, so a narrowed run needs a category of its own to leave the alerts of a full run open. The trailing
 * slash makes the whole ID the category, with no run ID after it.
 */
export function narrowedSarifCategory(checkIds: string[], clientId: string | null): string {
  const app = clientId === null ? '' : `client-id/${clientId}/`
  return `shopify-app-security/check-id/${[...new Set(checkIds)].sort().join(',')}/${app}`
}

/**
 * One rule per reviewed check, and one result per active finding. A superseded finding is left out, since the check's
 * agent result replaced it, as in the review. A suppressed finding is left out too: GitHub code scanning ignores SARIF
 * `suppressions` and would open an alert for it, so its alert, if open, closes as fixed instead. A finding's evidence is
 * a related location of its result, which the result's message links to, as code scanning shows only the related
 * locations that the message links to.
 *
 * The invocation lists each unresolved or not applicable check, each check that neither results file has, and each
 * coverage gap, as a notification. Code scanning reads a rule without results as passing, so a check without results
 * gets no rule, and the execution is marked unsuccessful when a check is unresolved or has no result, or there is no
 * results file: GitHub shows that as a warning on the analysis. Without a results file, one notification says so
 * instead of one for each check.
 *
 * `checkIds` are the IDs of `--check-id`, empty for a full run. A narrowed run carries its own category, which takes
 * precedence over the `category` input of GitHub's `upload-sarif` action. A full run leaves the category to it.
 */
export function appSecurityReviewSarif(result: AppSecurityReviewResult, {checkIds}: {checkIds: string[]}): SarifLog {
  const noResultsFile = result.resultsFiles.deterministic === null && result.resultsFiles.agent === null
  const unresolved = result.checks.some((check) => check.status === 'unresolved')
  const missingCheckIds = noResultsFile ? [] : result.missingCheckIds
  return {
    $schema: SARIF_SCHEMA,
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'Shopify app security check',
            semanticVersion: CLI_KIT_VERSION,
            informationUri: 'https://shopify.dev/docs/api/shopify-cli',
            rules: result.checks.map(sarifRule),
          },
        },
        invocations: [
          {
            executionSuccessful: !noResultsFile && !unresolved && missingCheckIds.length === 0,
            toolExecutionNotifications: [
              ...(noResultsFile ? [NO_RESULTS_FILE_NOTIFICATION] : []),
              ...result.checks.flatMap((check, ruleIndex) => checkNotifications(check, ruleIndex)),
              ...missingCheckIds.map(missingCheckNotification),
              ...(result.coverage?.gaps ?? []).flatMap((gap) => gapNotifications(gap, result.checks)),
            ],
          },
        ],
        ...(checkIds.length > 0 ? {automationDetails: {id: narrowedSarifCategory(checkIds, result.app.clientId)}} : {}),
        columnKind: 'utf16CodeUnits',
        results: result.checks.flatMap((check, ruleIndex) =>
          check.findings
            .filter((finding) => finding.disposition === 'active')
            .map((finding) => sarifResult(check, ruleIndex, finding, result.app.directory)),
        ),
      },
    ],
  }
}

/**
 * A plain text message. SARIF reads `[text](id)` in a message as a link to a location of the result, so literal
 * brackets, such as those of `redirect_urls[0]` or of a route file's `[id]`, and the backslash that escapes them, are
 * escaped with a backslash.
 */
function sarifMessage(text: string): SarifMessage {
  return {text: escapeSarifText(text)}
}

function escapeSarifText(text: string): string {
  return text.replace(/[\\[\]]/g, '\\$&')
}

const NO_RESULTS_FILE_NOTIFICATION: SarifNotification = {
  level: 'error',
  message: sarifMessage('No results file to review: run shopify app security check first.'),
  descriptor: {id: 'no-results-file'},
}

const STATUS_TEXT = {unresolved: 'is unresolved', 'not-applicable': 'is not applicable'} as const

/**
 * An unresolved check is a warning and a not applicable one a note, with the reason of the first source that
 * recorded the same status.
 */
function checkNotifications(check: AppSecurityCheck, ruleIndex: number): SarifNotification[] {
  if (check.status === 'executed') return []
  const reason = [check.bySource.deterministic, check.bySource.agent].find(
    (source) => source?.status === check.status && source.reason !== null,
  )?.reason
  const because = reason ? `: ${reason.message} (${reason.code})` : '.'
  return [
    {
      level: check.status === 'unresolved' ? 'warning' : 'note',
      message: sarifMessage(`${check.id} ${STATUS_TEXT[check.status]}${because}`),
      descriptor: {id: check.status},
      associatedRule: {id: check.id, index: ruleIndex},
    },
  ]
}

/**
 * A check that neither results file has, as a warning like an unresolved check. It has no rule to associate, so the
 * message names the check.
 */
function missingCheckNotification(checkId: string): SarifNotification {
  return {
    level: 'warning',
    message: sarifMessage(`${checkId} has no result: neither results file has this check.`),
    descriptor: {id: 'no-result'},
  }
}

/**
 * A gap of the latest scan, such as a skipped file or an unsupported language. The gap of an unresolved or not
 * applicable check is left out, since the check has a notification of its own with the same reason, and so is the
 * gap of a check that `--check-id` left out.
 */
function gapNotifications(gap: AppSecurityGap, checks: AppSecurityCheck[]): SarifNotification[] {
  if (gap.code === 'unresolved-check') return []
  const ruleIndex = gap.checkId === null ? -1 : checks.findIndex((check) => check.id === gap.checkId)
  if (gap.checkId !== null && checks[ruleIndex]?.status !== 'executed') return []
  return [
    {
      level: 'warning',
      message: sarifMessage(gap.message),
      descriptor: {id: gap.code},
      ...(gap.checkId === null ? {} : {associatedRule: {id: gap.checkId, index: ruleIndex}}),
      ...(gap.filePath === null ? {} : {locations: [{physicalLocation: {artifactLocation: fileUri(gap.filePath)}}]}),
    },
  ]
}

function sarifRule(check: AppSecurityCheck): SarifRule {
  return {
    id: check.id,
    shortDescription: {text: check.title},
    fullDescription: {text: check.description},
    // The guide is a link to read more, such as an API's documentation.
    help: {text: check.guide === null ? check.description : `${check.description}\n\nGuide: ${check.guide}`},
    ...(check.docsUrl === null ? {} : {helpUri: check.docsUrl}),
    defaultConfiguration: {level: LEVELS[check.severity]},
    properties: {tags: ['security'], 'security-severity': SECURITY_SEVERITIES[check.severity]},
  }
}

/**
 * The message ends with a link to each evidence location, with the location relative to the app as its text, as in the
 * review.
 */
function sarifResult(
  check: AppSecurityCheck,
  ruleIndex: number,
  finding: AppSecurityFinding,
  appDirectory: string,
): SarifResult {
  const relatedLocations = finding.evidence.map((evidence, id) => ({
    id,
    physicalLocation: sarifPhysicalLocation(evidence.location),
    ...(evidence.quote === null ? {} : {message: sarifMessage(evidence.quote)}),
  }))
  const text = escapeSarifText(finding.message === '' ? check.title : finding.message)
  const evidenceLinks = finding.evidence.map(
    (evidence, id) => `[${escapeSarifText(appRelativeLocation(evidence.location, appDirectory))}](${id})`,
  )
  return {
    ruleId: check.id,
    ruleIndex,
    level: LEVELS[check.severity],
    message: {text: evidenceLinks.length === 0 ? text : `${text} Evidence: ${evidenceLinks.join(', ')}.`},
    locations: [{physicalLocation: sarifPhysicalLocation(finding.location, finding.snippet)}],
    ...(relatedLocations.length > 0 ? {relatedLocations} : {}),
    properties: {
      source: finding.source,
      ...(finding.source === 'agent' && finding.confidence !== null ? {confidence: finding.confidence} : {}),
    },
  }
}

function appRelativeLocation(location: AppSecurityLocation, appDirectory: string): string {
  const path = relativePath(appDirectory, location.filePath)
  return location.line === null ? path : `${path}:${location.line}`
}

/**
 * An absolute `file:` URI, as SARIF consumers resolve them: GitHub's upload-sarif action makes it relative to the
 * repository checkout. A location without a line covers the whole file, so it has no region, and the snippet, which
 * belongs to a line, goes with it.
 */
function sarifPhysicalLocation(location: AppSecurityLocation, snippet: string | null = null): SarifPhysicalLocation {
  const artifactLocation = fileUri(location.filePath)
  if (location.line === null) return {artifactLocation}
  return {
    artifactLocation,
    region: {
      startLine: location.line,
      ...(location.column === null ? {} : {startColumn: location.column}),
      ...(snippet === null ? {} : {snippet: {text: snippet}}),
    },
  }
}

function fileUri(path: string): {uri: string} {
  return {uri: pathToFileURL(path).href}
}
