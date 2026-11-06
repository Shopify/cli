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
 * The terminal view of suppressed findings, which `check` and `review` show whatever `--verbose`, so a suppression is
 * never hidden. It returns data; each command's presenter places it in its own output.
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

function formatLocation(location: CombinedFinding['location']): string {
  return location.line === undefined ? location.file : `${location.file}:${location.line}`
}
