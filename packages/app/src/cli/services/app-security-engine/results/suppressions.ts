import {normalizePath} from '@shopify/cli-kit/node/path'
import type {CodeExcerptLine, FindingsSource, Location, StoredCheck, StoredFinding, SuppressionKind} from '../types.js'

/**
 * Matching of the entries of shopify.app-security.json against stored findings (§8.2). Pure: the caller reads and
 * validates the file, and no source file is read here, so a finding matches by the code its results file holds.
 */

/** One entry of shopify.app-security.json, as `readAppSecuritySuppressions` validates it. */
export interface SuppressionEntry {
  source: FindingsSource
  check: string
  kind: SuppressionKind
  /** Relative to the app directory, with `/`. */
  path: string
  /** Text of the flagged code. Without it, the entry covers every finding of the check in the file. */
  code?: string
  reason: string
  /** App configuration file names, such as shopify.app.toml, or client IDs. */
  configurations: string[]
}

/** The entries of shopify.app-security.json, and the results key of the run that they're applied to. */
export interface SuppressionsInput {
  entries: SuppressionEntry[]
  resultsKey: string
  /**
   * The entry paths whose files no longer exist in the app directory. Only a stale entry whose file is gone gets a
   * likely new path. Absent means that no file is known to be gone.
   */
  missingPaths?: string[]
}

/**
 * - `matched`: the entry matched at least one finding.
 * - `stale`: the entry matched nothing, although its source's executed result for the check could hold the finding.
 * - `ambiguous`: `code` matched more than one finding, so the entry suppresses none.
 * - `not-evaluated`: the run has no result that could hold the finding: the entry names other configurations, its
 *   source recorded no result for the check (the agent didn't record it, or the deterministic check didn't run), or
 *   that result is unresolved or not applicable and nothing matched.
 */
export type SuppressionEntryStatus = 'matched' | 'stale' | 'ambiguous' | 'not-evaluated'

/**
 * Why an entry is not evaluated: it names other configurations than the run's results key, or its source has no
 * executed result for the check that could hold the finding.
 */
export type SuppressionNotEvaluatedReason = 'other-configurations' | 'no-executed-result'

export interface SuppressionEntryResult {
  /** The entry's index in the file, from 0. */
  index: number
  entry: SuppressionEntry
  status: SuppressionEntryStatus
  /**
   * The findings the entry matched. Each one is suppressed, except a deterministic finding that a current
   * prefer-agent agent result supersedes: that one stays superseded, but still counts, because `check --blocking`
   * reads no agent results and needs the entry.
   */
  matched_finding_count: number
  /** For an ambiguous entry only: the locations of the findings that its `code` couldn't choose between. */
  candidate_locations?: Location[]
  /**
   * For a stale entry with `code` whose file is gone only: the path of the one finding of the same source and check,
   * at another path, whose code or message holds the entry's text. A hint: the entry still applies to nothing.
   */
  likely_path?: string
  /** For a not-evaluated entry only. */
  not_evaluated_reason?: SuppressionNotEvaluatedReason
}

/** What suppresses a finding: an entry of shopify.app-security.json, or the agent's own per-run suppression. */
export type FindingSuppression =
  | {origin: 'file'; entry_index: number; kind: SuppressionKind; reason: string}
  | {origin: 'agent'; reason: string}

/** The result of every entry, and the first entry that matched each finding. */
export interface SuppressionMatches {
  /** One result per entry, in file order. */
  entries: SuppressionEntryResult[]
  /** The first entry that matched the finding at `index` in the source's stored check, if any. */
  entryFor(source: FindingsSource, checkId: string, index: number): SuppressionEntryResult | undefined
}

/** The stored check that a source recorded for a check ID, if any. */
type RecordedCheckLookup = (source: FindingsSource, checkId: string) => StoredCheck | undefined

interface EntryMatch {
  status: SuppressionEntryStatus
  /** Indexes into the stored check's findings. */
  findingIndexes: number[]
  /** For an ambiguous entry: indexes into the stored check's findings that `code` couldn't choose between. */
  candidateIndexes?: number[]
}

/** An entry's result, with the matched finding indexes that only the matching needs. */
type EntryResult = SuppressionEntryResult & {findingIndexes: number[]}

interface ScoredCandidate {
  index: number
  inCode: boolean
  inMessage: boolean
}

/**
 * Applies the matching rules to each entry (§8.2):
 * 1. The candidates are the findings of the entry's source and check in the entry's path, when one of the entry's
 *    configurations names the run's results key.
 * 2. Without `code`, every candidate matches.
 * 3. With `code`, a candidate matches when the normalized text occurs in its captured code (`occursInCode`) or in its
 *    message.
 * 4. When more than one candidate matches, those where the text occurs in both the code and the message are kept. When
 *    more than one is still left, or none, the entry is ambiguous and matches nothing.
 * 5. An entry that matches nothing is stale when its source's result for the check is executed, and not evaluated
 *    otherwise. When a stale entry's file is gone and exactly one finding of its source and check at another path
 *    holds its text, that path is the entry's likely new path. The entry still matches nothing: there is no
 *    rematching.
 */
export function matchSuppressionEntries(
  {entries: suppressionEntries, resultsKey, missingPaths = []}: SuppressionsInput = {entries: [], resultsKey: ''},
  recordedCheck: RecordedCheckLookup,
): SuppressionMatches {
  const missing = new Set(missingPaths)
  const entries = suppressionEntries.map((entry, index): EntryResult => {
    if (!appliesToResultsKey(entry, resultsKey)) return notEvaluated(index, entry, 'other-configurations')
    const check = recordedCheck(entry.source, entry.check)
    if (!check) return notEvaluated(index, entry, 'no-executed-result')

    const {status, findingIndexes, candidateIndexes} = matchEntry(entry, check)
    const likelyPath = status === 'stale' && missing.has(entry.path) ? likelyNewPath(entry, check) : undefined
    return {
      index,
      entry,
      status,
      matched_finding_count: findingIndexes.length,
      findingIndexes,
      ...(candidateIndexes ? {candidate_locations: candidateIndexes.map((at) => check.findings[at]!.location)} : {}),
      ...(likelyPath === undefined ? {} : {likely_path: likelyPath}),
      ...(status === 'not-evaluated' ? {not_evaluated_reason: 'no-executed-result'} : {}),
    }
  })

  const firstEntryByFinding = new Map<string, SuppressionEntryResult>()
  for (const {findingIndexes, ...result} of entries) {
    for (const index of findingIndexes) {
      const key = findingKey(result.entry.source, result.entry.check, index)
      if (!firstEntryByFinding.has(key)) firstEntryByFinding.set(key, result)
    }
  }

  return {
    entries: entries.map(({findingIndexes: _findingIndexes, ...result}) => result),
    entryFor: (source, checkId, index) => firstEntryByFinding.get(findingKey(source, checkId, index)),
  }
}

/**
 * The one suppression rule, for both sources: what suppresses a stored finding, or undefined when nothing does. An
 * entry of shopify.app-security.json that matched the finding comes first, whatever the finding's source. The agent's
 * own per-run `suppression` is the rule's second origin, for an agent finding that no entry matched. A `suppression`
 * on a deterministic finding was edited by hand, and is ignored.
 */
export function findingSuppression(
  finding: StoredFinding,
  source: FindingsSource,
  matchedEntry: SuppressionEntryResult | undefined,
): FindingSuppression | undefined {
  if (matchedEntry) {
    const {index, entry} = matchedEntry
    return {origin: 'file', entry_index: index, kind: entry.kind, reason: entry.reason}
  }
  if (source === 'agent' && finding.suppression !== undefined) {
    return {origin: 'agent', reason: finding.suppression.justification}
  }
  return undefined
}

/**
 * Text as the matching compares it: without whitespace, commas and semicolons, which reformatting moves, and with every
 * quote as `"`, because formatters and lint fixes swap quote styles.
 */
function normalizeSuppressionText(text: string): string {
  return text.replace(/[\s,;]/g, '').replace(/['"`]/g, '"')
}

/**
 * A configuration names a results key: an app configuration file name without its `.toml` extension, as `check`
 * names the results directory of that configuration, or a client ID as it is.
 */
function configurationResultsKey(configuration: string): string {
  return configuration.endsWith('.toml') ? configuration.slice(0, -'.toml'.length) : configuration
}

function appliesToResultsKey(entry: SuppressionEntry, resultsKey: string): boolean {
  return entry.configurations.some((configuration) => configurationResultsKey(configuration) === resultsKey)
}

function findingKey(source: FindingsSource, checkId: string, index: number): string {
  return JSON.stringify([source, checkId, index])
}

function notEvaluated(index: number, entry: SuppressionEntry, reason: SuppressionNotEvaluatedReason): EntryResult {
  return {
    index,
    entry,
    status: 'not-evaluated',
    matched_finding_count: 0,
    findingIndexes: [],
    not_evaluated_reason: reason,
  }
}

function matchEntry(entry: SuppressionEntry, check: StoredCheck): EntryMatch {
  const candidates = check.findings.flatMap((finding, index) =>
    normalizePath(finding.location.file) === entry.path ? [{finding, index}] : [],
  )
  if (entry.code === undefined) return matchOrMiss(candidates, check)

  const text = normalizeSuppressionText(entry.code)
  // Text that is only whitespace, commas and semicolons names nothing.
  if (text === '') return matchOrMiss([], check)
  const matches = candidates
    .map(({finding, index}): ScoredCandidate => ({index, ...textOccurrence(text, finding, entry.path)}))
    .filter(({inCode, inMessage}) => inCode || inMessage)
  if (matches.length <= 1) return matchOrMiss(matches, check)

  const inCodeAndMessage = matches.filter(({inCode, inMessage}) => inCode && inMessage)
  if (inCodeAndMessage.length === 1) return matchOrMiss(inCodeAndMessage, check)
  // The findings that rule 4 kept, or every match when it kept none.
  const undecided = inCodeAndMessage.length > 1 ? inCodeAndMessage : matches
  return {status: 'ambiguous', findingIndexes: [], candidateIndexes: undecided.map(({index}) => index)}
}

/**
 * The likely new path of a stale entry with `code`: the path of the one finding of the entry's check, at another path,
 * whose code or message holds the entry's text, as rule 3 compares it. Undefined when no finding or several do.
 */
function likelyNewPath(entry: SuppressionEntry, check: StoredCheck): string | undefined {
  if (entry.code === undefined) return undefined
  const text = normalizeSuppressionText(entry.code)
  if (text === '') return undefined
  const paths = check.findings.flatMap((finding) => {
    const path = normalizePath(finding.location.file)
    if (path === entry.path) return []
    const {inCode, inMessage} = textOccurrence(text, finding, path)
    return inCode || inMessage ? [path] : []
  })
  return paths.length === 1 ? paths[0] : undefined
}

/** Whether normalized text occurs in a finding's captured code, in `path`, and in its message. */
function textOccurrence(text: string, finding: StoredFinding, path: string): Omit<ScoredCandidate, 'index'> {
  return {
    inCode: occursInCode(text, finding, path),
    inMessage: normalizeSuppressionText(finding.message).includes(text),
  }
}

function matchOrMiss(matches: {index: number}[], check: StoredCheck): EntryMatch {
  if (matches.length > 0) return {status: 'matched', findingIndexes: matches.map(({index}) => index)}
  return {status: check.status === 'executed' ? 'stale' : 'not-evaluated', findingIndexes: []}
}

/**
 * Whether normalized text occurs in a finding's captured code: in its excerpt, where the occurrence must cover the
 * flagged line, so a statement that a reformat split over the lines around it still matches but a neighboring line
 * alone doesn't; or in one of its evidence lines in the same file. A finding without an excerpt, such as one without a
 * line or in an environment file, matches by its message alone.
 */
function occursInCode(text: string, finding: StoredFinding, path: string): boolean {
  const {line} = finding.location
  if (finding.code_excerpt && line !== undefined && occursAcrossLine(text, finding.code_excerpt, line)) return true
  return finding.evidence.some(
    (evidence) =>
      evidence.code_excerpt !== undefined &&
      normalizePath(evidence.location.file) === path &&
      evidence.code_excerpt.some((excerptLine) => normalizeSuppressionText(excerptLine.text).includes(text)),
  )
}

function occursAcrossLine(text: string, excerpt: CodeExcerptLine[], line: number): boolean {
  const pieces = excerpt.map((excerptLine) => ({
    line: excerptLine.line,
    text: normalizeSuppressionText(excerptLine.text),
  }))
  const flaggedIndex = pieces.findIndex((piece) => piece.line === line)
  if (flaggedIndex === -1) return false

  const joined = pieces.map((piece) => piece.text).join('')
  const flaggedStart = pieces.slice(0, flaggedIndex).reduce((length, piece) => length + piece.text.length, 0)
  const flaggedEnd = flaggedStart + pieces[flaggedIndex]!.text.length
  const coversFlaggedLine = (position: number) => position < flaggedEnd && position + text.length > flaggedStart
  for (let position = joined.indexOf(text); position !== -1; position = joined.indexOf(text, position + 1)) {
    if (coversFlaggedLine(position)) return true
  }
  return false
}
