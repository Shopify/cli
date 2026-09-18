/**
 * Mode outcomes per owner and deduplicated static coverage.
 *
 * Every static result repeats the scan-wide blockers (skipped files,
 * unsupported languages) for its owner, so those are deduplicated across
 * owners by content. `files_scanned` is likewise scan-wide and is reported per
 * owner, never summed. Required-check `unresolved_check` gaps are owner-local
 * and stay separate. No `produced_at` is compared anywhere here.
 */
import {getAppDoctorResultOutcome} from '../results/index.js'
import type {
  AppDoctorInterpretedCheck,
  AppDoctorInterpretedCoverage,
  AppDoctorInterpretedCoverageGap,
  AppDoctorInterpretedCoverageOwner,
  AppDoctorInterpretedSkippedFile,
  AppDoctorInterpretedUnsupportedLanguage,
  AppDoctorModeOutcome,
} from './types.js'
import type {AppDoctorResult, AppDoctorStaticResult} from '../results/index.js'

const isStatic = (result: AppDoctorResult): result is AppDoctorStaticResult => result.mode === 'static'

const compareOwners = (
  left: {scopeIdentity: string; checkId: string},
  right: {scopeIdentity: string; checkId: string},
): number => left.scopeIdentity.localeCompare(right.scopeIdentity) || left.checkId.localeCompare(right.checkId)

const ownerKey = (scopeIdentity: string, checkId: string) => JSON.stringify([scopeIdentity, checkId])

function modeOutcome(result: AppDoctorResult | undefined): AppDoctorModeOutcome {
  const outcome = getAppDoctorResultOutcome(result)
  if (result === undefined || outcome === 'not_run') return {outcome: 'not_run'}
  const {reason, guidance} = result.execution
  return {
    outcome,
    producedAt: result.produced_at,
    checkVersion: result.check_version,
    findingCount: result.findings.length,
    ...(reason === undefined ? {} : {reason}),
    ...(guidance === undefined ? {} : {guidance}),
    ...(result.mode === 'agent' ? {promptHash: result.prompt_hash} : {}),
  }
}

/**
 * One check per (scope, check) that appears in any result, both modes always
 * reported. Callers guarantee at most one result per owner tuple.
 */
export function interpretAppDoctorChecks(results: ReadonlyArray<AppDoctorResult>): AppDoctorInterpretedCheck[] {
  const owners = new Map<string, {scopeIdentity: string; checkId: string}>()
  const byOwnerAndMode = new Map<string, AppDoctorResult>()
  for (const result of results) {
    owners.set(ownerKey(result.scope_identity, result.check_id), {
      scopeIdentity: result.scope_identity,
      checkId: result.check_id,
    })
    byOwnerAndMode.set(`${result.mode}:${ownerKey(result.scope_identity, result.check_id)}`, result)
  }
  return [...owners.values()].sort(compareOwners).map(({scopeIdentity, checkId}) => ({
    scopeIdentity,
    checkId,
    static: modeOutcome(byOwnerAndMode.get(`static:${ownerKey(scopeIdentity, checkId)}`)),
    agent: modeOutcome(byOwnerAndMode.get(`agent:${ownerKey(scopeIdentity, checkId)}`)),
  }))
}

/** Keep the first observation for each key, in first-seen order. */
function uniqueBy<TItem>(items: ReadonlyArray<TItem>, keyOf: (item: TItem) => string): TItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = keyOf(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function mergeUnsupportedLanguages(
  languages: ReadonlyArray<AppDoctorInterpretedUnsupportedLanguage>,
): AppDoctorInterpretedUnsupportedLanguage[] {
  const filesByName = new Map<string, Set<string>>()
  for (const language of languages) {
    const files = filesByName.get(language.name) ?? new Set<string>()
    language.files.forEach((file) => files.add(file))
    filesByName.set(language.name, files)
  }
  return [...filesByName.entries()]
    .map(([name, files]) => ({name, files: [...files].sort()}))
    .sort((left, right) => left.name.localeCompare(right.name))
}

type StaticGap = AppDoctorStaticResult['coverage']['gaps'][number]

const scanWideGap = (gap: StaticGap): AppDoctorInterpretedCoverageGap => ({
  code: gap.code,
  message: gap.message,
  ...(gap.file === undefined ? {} : {file: gap.file}),
})

const ownerLocalGap = (result: AppDoctorStaticResult, gap: StaticGap): AppDoctorInterpretedCoverageGap => ({
  ...scanWideGap(gap),
  owner: {scopeIdentity: result.scope_identity, checkId: result.check_id},
})

/**
 * Skipped files are identified by file; unsupported languages by message and
 * file; unresolved checks by their owner, so they never collapse across owners.
 */
function gapKey(gap: AppDoctorInterpretedCoverageGap): string {
  switch (gap.code) {
    case 'skipped_file':
      return JSON.stringify([gap.code, gap.file])
    case 'unsupported_language':
      return JSON.stringify([gap.code, gap.message, gap.file])
    case 'unresolved_check':
      return JSON.stringify([gap.code, gap.message, gap.owner])
  }
}

function interpretGaps(staticResults: ReadonlyArray<AppDoctorStaticResult>): AppDoctorInterpretedCoverageGap[] {
  const gaps = staticResults.flatMap((result) =>
    result.coverage.gaps.map((gap) =>
      gap.code === 'unresolved_check' ? ownerLocalGap(result, gap) : scanWideGap(gap),
    ),
  )
  // Owner-local gaps carry their owner in the key, so only scan-wide duplicates collapse.
  return uniqueBy(gaps, gapKey).sort(
    (left, right) =>
      left.code.localeCompare(right.code) ||
      (left.file ?? '').localeCompare(right.file ?? '') ||
      left.message.localeCompare(right.message) ||
      compareOwners(left.owner ?? {scopeIdentity: '', checkId: ''}, right.owner ?? {scopeIdentity: '', checkId: ''}),
  )
}

const coverageOwner = (result: AppDoctorStaticResult): AppDoctorInterpretedCoverageOwner => ({
  scopeIdentity: result.scope_identity,
  checkId: result.check_id,
  filesScanned: result.coverage.files_scanned,
  gapCount: result.coverage.gaps.length,
})

/** Coverage is complete only when static results exist and none of them reports a gap. */
export function interpretAppDoctorCoverage(results: ReadonlyArray<AppDoctorResult>): AppDoctorInterpretedCoverage {
  const staticResults = results.filter(isStatic)
  const filesSkipped: AppDoctorInterpretedSkippedFile[] = uniqueBy(
    staticResults.flatMap((result) => result.coverage.files_skipped),
    (skipped) => skipped.path,
  ).sort((left, right) => left.path.localeCompare(right.path))
  return {
    staticResultCount: staticResults.length,
    complete: staticResults.length > 0 && staticResults.every((result) => result.coverage.gaps.length === 0),
    filesSkipped,
    unsupportedLanguages: mergeUnsupportedLanguages(
      staticResults.flatMap((result) => result.coverage.unsupported_languages),
    ),
    gaps: interpretGaps(staticResults),
    owners: staticResults.map(coverageOwner).sort(compareOwners),
  }
}
