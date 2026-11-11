import {APP_SECURITY_SUPPRESSIONS_FILE_NAME} from './app-security-artifacts.js'
import {countLabel} from './app-security-format.js'
import {
  activeFindings,
  type CombinedCheck,
  type CombinedFinding,
  type FindingSuppression,
  type Severity,
  type SuppressionEntryResult,
  type SuppressionKind,
} from './app-security-engine/index.js'
import type {AlertCustomSection, InlineToken, TokenItem} from '@shopify/cli-kit/node/ui'

/**
 * The terminal views of suppressed findings and of the entries of shopify.app-security.json that apply to nothing,
 * which `check` and `review` show whatever `--verbose`, so a suppression is never hidden and an entry is never ignored
 * silently. They return data; each command's presenter places it in its own output.
 */

export interface SuppressedFindingsView {
  /** "2 findings suppressed." */
  headline: string
  /** "3 active · 2 suppressed", over the checks shown. */
  counts: string
  /**
   * One section per check with suppressed findings, most severe first, that lists each suppressed finding with its kind
   * and reason. Then the entries of shopify.app-security.json that matched a finding of those checks, with the number
   * of findings each one matched.
   */
  sections: AlertCustomSection[]
}

/** The entries that apply to nothing: stale, ambiguous and not evaluated. */
export interface UnappliedEntriesView {
  /**
   * "2 entries in shopify.app-security.json suppress nothing.", or "3 entries in shopify.app-security.json not
   * evaluated." when no entry is stale or ambiguous.
   */
  headline: string
  /** Whether a stale or an ambiguous entry needs a change. Not-evaluated entries need none. */
  needsChange: boolean
  /**
   * The stale entries, each with its kind, reason and likely new path, then the ambiguous entries, each with the
   * locations of the findings its code matches, then one line that counts the not-evaluated entries with their reasons.
   */
  sections: AlertCustomSection[]
}

interface SuppressedFinding {
  finding: CombinedFinding
  suppression: FindingSuppression
}

const SEVERITY_LABEL: Record<Severity, string> = {high: 'High', medium: 'Medium', low: 'Low'}
const KIND_LABEL: Record<SuppressionKind, string> = {
  'false-positive': 'false positive',
  'accepted-risk': 'accepted risk',
}

/**
 * The suppressed findings of `checks`, the checks that the output shows, in their order, or undefined when none is
 * suppressed. `suppressions` holds the result of every entry of shopify.app-security.json.
 */
export function suppressedFindingsView(
  checks: CombinedCheck[],
  suppressions: SuppressionEntryResult[],
): SuppressedFindingsView | undefined {
  const checksWithSuppressions = checks.filter((check) => suppressedFindings(check).length > 0)
  if (checksWithSuppressions.length === 0) return undefined

  const suppressed = checks.reduce((total, check) => total + suppressedFindings(check).length, 0)
  const active = checks.reduce((total, check) => total + activeFindings(check).length, 0)
  const shownCheckIds = new Set(checks.map((check) => check.id))
  const matchedEntries = suppressions.filter(
    (result) => result.matched_finding_count > 0 && shownCheckIds.has(result.entry.check),
  )

  return {
    headline: `${countLabel(suppressed, 'finding')} suppressed.`,
    counts: activeAndSuppressedCounts(active, suppressed),
    sections: [
      ...checksWithSuppressions.map(checkSection),
      ...(matchedEntries.length > 0 ? [entriesSection(matchedEntries)] : []),
    ],
  }
}

/**
 * The entries of `suppressions` that apply to nothing, in file order, or undefined when every entry matched. The
 * caller passes the entries of the checks that the output shows.
 */
export function unappliedEntriesView(suppressions: SuppressionEntryResult[]): UnappliedEntriesView | undefined {
  const stale = suppressions.filter((result) => result.status === 'stale')
  const ambiguous = suppressions.filter((result) => result.status === 'ambiguous')
  const notEvaluated = suppressions.filter((result) => result.status === 'not-evaluated')
  const needingChange = stale.length + ambiguous.length
  if (needingChange + notEvaluated.length === 0) return undefined

  return {
    headline: unappliedEntriesHeadline(needingChange, notEvaluated.length),
    needsChange: needingChange > 0,
    sections: [
      ...(stale.length > 0 ? staleEntriesSections(stale) : []),
      ...(ambiguous.length > 0 ? ambiguousEntriesSections(ambiguous) : []),
      ...(notEvaluated.length > 0 ? [{body: {subdued: notEvaluatedLine(notEvaluated)}}] : []),
    ],
  }
}

/** Every suppressed finding carries what suppresses it; the type guard keeps that link. */
function suppressedFindings(check: CombinedCheck): SuppressedFinding[] {
  return check.findings.flatMap((finding) =>
    finding.disposition === 'suppressed' && finding.suppressed_by
      ? [{finding, suppression: finding.suppressed_by}]
      : [],
  )
}

function activeAndSuppressedCounts(active: number, suppressed: number): string {
  return `${active} active · ${suppressed} suppressed`
}

function checkSection(check: CombinedCheck): AlertCustomSection {
  const suppressed = suppressedFindings(check)
  const counts = activeAndSuppressedCounts(activeFindings(check).length, suppressed.length)
  return {
    title: `${SEVERITY_LABEL[check.severity]} · ${check.id} · ${counts}`,
    body: {list: {items: suppressed.map(suppressedFindingItem)}},
  }
}

/** The location, the source and what suppresses the finding, then the reason on its own line. */
function suppressedFindingItem({finding, suppression}: SuppressedFinding): TokenItem<InlineToken> {
  return [
    {filePath: formatLocation(finding.location)},
    {subdued: `· ${finding.source} · ${suppressionLabel(suppression)}`},
    `\n${suppression.reason}`,
  ]
}

/** An entry is named as the file's validation errors name it: `suppressions[2]`. */
function suppressionLabel(suppression: FindingSuppression): string {
  if (suppression.origin === 'agent') return 'suppressed by the agent'
  return `${KIND_LABEL[suppression.kind]} · ${entryLabel(suppression.entry_index)}`
}

function entryLabel(index: number): string {
  return `suppressions[${index}]`
}

/** A path-level entry can match several findings, so each entry says how many it matched. */
function entriesSection(results: SuppressionEntryResult[]): AlertCustomSection {
  return {
    title: 'Entries in shopify.app-security.json',
    body: {
      list: {
        items: results.map(({index, entry, matched_finding_count: matchedFindingCount}) => [
          {subdued: `${entryLabel(index)}:`},
          `${entry.source} ${entry.check} in`,
          {filePath: entry.path},
          {subdued: `· matches ${countLabel(matchedFindingCount, 'finding')}`},
        ]),
      },
    },
  }
}

function unappliedEntriesHeadline(needingChange: number, notEvaluated: number): string {
  const file = APP_SECURITY_SUPPRESSIONS_FILE_NAME
  if (needingChange === 0) return `${entryCountLabel(notEvaluated)} in ${file} not evaluated.`
  return `${entryCountLabel(needingChange)} in ${file} ${needingChange === 1 ? 'suppresses' : 'suppress'} nothing.`
}

function staleEntriesSections(stale: SuppressionEntryResult[]): AlertCustomSection[] {
  return [
    {
      title: `Stale entries in ${APP_SECURITY_SUPPRESSIONS_FILE_NAME}`,
      body: {list: {items: stale.map(staleEntryItem)}},
    },
    {
      body:
        stale.length === 1
          ? 'This entry matches no finding. Remove it, or update it to match the code.'
          : 'These entries match no finding. Remove each entry, or update it to match the code.',
    },
  ]
}

function ambiguousEntriesSections(ambiguous: SuppressionEntryResult[]): AlertCustomSection[] {
  return [
    {
      title: `Ambiguous entries in ${APP_SECURITY_SUPPRESSIONS_FILE_NAME}`,
      body: {list: {items: ambiguous.map(ambiguousEntryItem)}},
    },
    {
      body:
        ambiguous.length === 1
          ? 'This entry suppresses nothing. Give it a more specific code that matches one finding.'
          : 'These entries suppress nothing. Give each entry a more specific code that matches one finding.',
    },
  ]
}

/** "suppressions[2]: deterministic COMMITTED_SECRET in", then the path: how an entry is named in each list. */
function entryHeading({index, entry}: SuppressionEntryResult): InlineToken[] {
  return [{subdued: `${entryLabel(index)}:`}, `${entry.source} ${entry.check} in`, {filePath: entry.path}]
}

/** The entry with its kind, then its reason and its likely new path on their own lines. */
function staleEntryItem(result: SuppressionEntryResult): TokenItem<InlineToken> {
  return [
    ...entryHeading(result),
    {subdued: `· ${KIND_LABEL[result.entry.kind]}`},
    `\n${result.entry.reason}`,
    ...(result.likely_path === undefined ? [] : ['\nMaybe moved to', {filePath: result.likely_path}]),
  ]
}

/** The entry with the number of findings its code matches, then their locations on their own line. */
function ambiguousEntryItem(result: SuppressionEntryResult): TokenItem<InlineToken> {
  const locations = result.candidate_locations ?? []
  return [
    ...entryHeading(result),
    {subdued: `· matches ${countLabel(locations.length, 'finding')}`},
    '\nAt',
    ...locations.flatMap((location, index): InlineToken[] => [
      ...(index > 0 ? [{char: ','}] : []),
      {filePath: formatLocation(location)},
    ]),
  ]
}

/** Entries whose source has no executed result for the check. */
function notEvaluatedLine(results: SuppressionEntryResult[]): string {
  const reason = results.length === 1 ? 'no executed result for its check' : 'no executed results for their checks'
  return `Not evaluated: ${entryCountLabel(results.length)} (${reason}).`
}

function entryCountLabel(total: number): string {
  return `${total} ${total === 1 ? 'entry' : 'entries'}`
}

function formatLocation(location: CombinedFinding['location']): string {
  return location.line === undefined ? location.file : `${location.file}:${location.line}`
}
