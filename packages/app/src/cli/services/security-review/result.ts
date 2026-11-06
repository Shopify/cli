import {appSecurityReviewJsonOutputSchema, type AppSecurityReviewResult} from './types.js'
import {
  projectAppSecurityApp,
  projectAppSecurityBlocking,
  projectAppSecurityPath,
  projectAppSecurityRelativePath,
  projectAppSecuritySavedSuppression,
  projectAppSecurityScanDirectory,
  projectAppSecurityScope,
  projectAppSecuritySuppressions,
} from '../app-security/result.js'
import {renderSecurityReview} from '../security-review-output.js'
import {formatJsonOutputTimestamp, jsonOutputTimestampSchema} from '@shopify/cli-kit/node/json-output-schema'
import {outputResult} from '@shopify/cli-kit/node/output'
import type {
  CombinedCheck,
  CombinedFinding,
  DeterministicFindingsDocument,
  FindingSuppression,
  SourceCheckResult,
  StoredCheckStatus,
  StoredEvidence,
  StoredFinding,
} from '../app-security-engine/index.js'
import type {ReviewedAppSecurityResults, SavedReviewSuppressions, SecurityReviewResult} from '../security-review.js'

type AppSecurityCheck = AppSecurityReviewResult['checks'][number]
type AppSecurityFinding = AppSecurityCheck['findings'][number]
type AppSecuritySourceResult = NonNullable<AppSecurityCheck['bySource']['deterministic']>
type AppSecurityLocation = AppSecurityFinding['location']
type AppSecurityFindingSuppression = AppSecurityFinding['suppression']
type AppSecurityDetection = NonNullable<AppSecurityReviewResult['detection']>
type AppSecurityCoverage = NonNullable<AppSecurityReviewResult['coverage']>
type AppSecurityResultsFiles = AppSecurityReviewResult['resultsFiles']
type AppSecuritySavedSuppressions = NonNullable<AppSecurityReviewResult['savedSuppressions']>

type StoredDetection = DeterministicFindingsDocument['detection']
type StoredCoverage = DeterministicFindingsDocument['coverage']

/*
 * The closed enums whose stored values have a different public spelling, each stored value mapped to its public one.
 * A new stored value fails to compile until it is mapped. Enums with the same spelling are assigned directly, and
 * type-check rejects a stored value that the public schema doesn't allow.
 */
const CHECK_STATUSES: Record<StoredCheckStatus, AppSecurityCheck['status']> = {
  executed: 'executed',
  not_applicable: 'not-applicable',
  unresolved: 'unresolved',
}
const ANALYSIS_MODES: Record<
  NonNullable<SourceCheckResult['analysis_mode']>,
  NonNullable<AppSecuritySourceResult['analysisMode']>
> = {regex: 'regex', structured_config: 'structured-config', ast: 'ast'}
const FRAMEWORKS: Record<StoredDetection['framework'], AppSecurityDetection['framework']> = {
  react_router: 'react-router',
  none: 'none',
  unknown: 'unknown',
  mixed: 'mixed',
}
const SURFACES: Record<StoredDetection['surface'], AppSecurityDetection['surface']> = {
  react_router: 'react-router',
  theme_app_extension: 'theme-app-extension',
  config_only: 'config-only',
  unknown: 'unknown',
  mixed: 'mixed',
}
const SKIPPED_FILE_REASONS: Record<
  StoredCoverage['files_skipped'][number]['reason'],
  AppSecurityCoverage['filesSkipped'][number]['reason']
> = {too_large: 'too-large', unreadable: 'unreadable'}
const GAP_CODES: Record<StoredCoverage['gaps'][number]['code'], AppSecurityCoverage['gaps'][number]['code']> = {
  skipped_file: 'skipped-file',
  unsupported_framework: 'unsupported-framework',
  unsupported_language: 'unsupported-language',
  unresolved_check: 'unresolved-check',
}

/**
 * Presents reviewed results as JSON, or in the terminal. Either way, sets exit code 1 after the output when they
 * breach `--blocking`.
 */
export function renderSecurityReviewResult(
  review: ReviewedAppSecurityResults,
  options: {verbose: boolean},
  format: 'json' | 'text',
): void {
  if (format === 'json') {
    outputResult(appSecurityReviewJsonOutputSchema.encode(appSecurityReviewResult(review)))
  } else {
    renderSecurityReview({
      result: review.result,
      verbose: options.verbose,
      now: new Date(),
      commands: review.commands,
      ...(review.savedSuppressions ? {savedSuppressions: review.savedSuppressions} : {}),
    })
  }

  if (review.result.blocking.blockedChecks > 0) process.exitCode = 1
}

function appSecurityReviewResult({
  selection,
  result,
  savedSuppressions,
}: ReviewedAppSecurityResults): AppSecurityReviewResult {
  const {appDirectory} = selection
  const deterministic = result.sources.deterministic?.document
  return {
    status: 'success',
    valid: result.blocking.blockedChecks === 0,
    app: projectAppSecurityApp(selection),
    resultsDirectory: projectAppSecurityPath(result.resultsDirectory),
    resultsFiles: projectResultsFiles(result.sources),
    detection: deterministic ? projectDetection(deterministic.detection, appDirectory) : null,
    coverage: deterministic ? projectCoverage(deterministic.coverage, appDirectory) : null,
    scopeDiffers: result.scopeDiffers,
    checks: result.checks.map((check) => projectCheck(check, appDirectory, result.findingNumbers)),
    resultsDigest: result.resultsDigest,
    blocking: projectAppSecurityBlocking(result.blocking),
    suppressions: projectAppSecuritySuppressions(appDirectory, result.suppressions, result.allChecks),
    savedSuppressions: savedSuppressions ? projectSavedSuppressions(savedSuppressions, appDirectory) : null,
  }
}

function projectSavedSuppressions(
  {path, saved, companionNumbers}: SavedReviewSuppressions,
  appDirectory: string,
): AppSecuritySavedSuppressions {
  return {
    filePath: projectAppSecurityPath(path),
    entries: saved.map((savedSuppression) => ({
      ...projectAppSecuritySavedSuppression(appDirectory, savedSuppression),
      findingNumber: savedSuppression.findingNumber,
    })),
    companionFindingNumbers: companionNumbers,
  }
}

function projectResultsFiles({deterministic, agent}: SecurityReviewResult['sources']): AppSecurityResultsFiles {
  return {
    deterministic: deterministic
      ? {
          path: projectAppSecurityPath(deterministic.path),
          generatedAt: projectTimestamp(deterministic.document.generated_at),
          engine: {
            name: deterministic.document.engine.name,
            version: deterministic.document.engine.version,
            ruleset: deterministic.document.engine.ruleset,
          },
          scope: projectAppSecurityScope(deterministic.document.coverage.scope),
        }
      : null,
    agent: agent
      ? {
          path: projectAppSecurityPath(agent.path),
          generatedAt: projectTimestamp(agent.document.generated_at),
          engine: {name: agent.document.engine.name, version: agent.document.engine.version},
          scope: projectAppSecurityScope(agent.document.scope),
        }
      : null,
  }
}

/**
 * A recorded time as a public instant, or null when it isn't a valid one: it doesn't parse, or its year doesn't fit
 * the four digits of the public format.
 */
function projectTimestamp(time: string): string | null {
  const parsed = Date.parse(time)
  if (Number.isNaN(parsed)) return null
  const timestamp = formatJsonOutputTimestamp(new Date(parsed))
  return jsonOutputTimestampSchema.safeParse(timestamp).success ? timestamp : null
}

/** An optional text that a results file leaves out or leaves empty: the text view shows neither. */
function projectOptionalText(text: string | undefined): string | null {
  return text === undefined || text === '' ? null : text
}

/** Lines and columns are one-based in the results files, and JSON output shows them as recorded. */
function projectPosition(position: number | undefined): number | null {
  return position ?? null
}

function projectLocation(location: StoredFinding['location'], appDirectory: string): AppSecurityLocation {
  return {
    filePath: projectAppSecurityRelativePath(appDirectory, location.file),
    line: projectPosition(location.line),
    column: projectPosition(location.column),
  }
}

function projectDetection(detection: StoredDetection, appDirectory: string): AppSecurityDetection {
  return {
    framework: FRAMEWORKS[detection.framework],
    surface: SURFACES[detection.surface],
    languages: detection.languages.map((language) => ({
      name: language.name,
      support: language.support,
      files: language.files.map((file) => ({path: projectAppSecurityRelativePath(appDirectory, file)})),
    })),
  }
}

function projectCoverage(coverage: StoredCoverage, appDirectory: string): AppSecurityCoverage {
  return {
    filesScanned: coverage.files_scanned,
    filesSkipped: coverage.files_skipped.map((file) => ({
      path: projectAppSecurityRelativePath(appDirectory, file.path),
      reason: SKIPPED_FILE_REASONS[file.reason],
      sizeBytes: file.size_bytes ?? null,
      detail: projectOptionalText(file.detail),
    })),
    gaps: coverage.gaps.map((gap) => ({
      code: GAP_CODES[gap.code],
      message: gap.message,
      checkId: gap.check_id ?? null,
      filePath: gap.file === undefined ? null : projectAppSecurityRelativePath(appDirectory, gap.file),
    })),
    scanDirectories: coverage.scan_directories.map((scanDirectory) =>
      projectAppSecurityScanDirectory(appDirectory, scanDirectory),
    ),
  }
}

function projectCheck(
  check: CombinedCheck,
  appDirectory: string,
  findingNumbers: SecurityReviewResult['findingNumbers'],
): AppSecurityCheck {
  return {
    id: check.id,
    title: check.title,
    severity: check.severity,
    description: check.description,
    guide: projectOptionalText(check.guide),
    docsUrl: check.docs_url ?? null,
    precedence: check.precedence,
    appliedPrecedence: check.applied_precedence,
    status: CHECK_STATUSES[check.status],
    bySource: {
      deterministic: check.by_source.deterministic ? projectSourceResult(check.by_source.deterministic) : null,
      agent: check.by_source.agent ? projectSourceResult(check.by_source.agent) : null,
    },
    findings: check.findings.map((finding) => projectFinding(finding, findingNumbers.get(finding)!, appDirectory)),
  }
}

function projectSourceResult(result: SourceCheckResult): AppSecuritySourceResult {
  return {
    version: result.version,
    status: CHECK_STATUSES[result.status],
    reason: result.reason ? {code: result.reason.code, message: result.reason.message} : null,
    analysisMode: result.analysis_mode ? ANALYSIS_MODES[result.analysis_mode] : null,
    generatedAt: projectTimestamp(result.generated_at),
  }
}

/** Each source's finding has only its own fields: the stored format allows the other source's too. */
function projectFinding(finding: CombinedFinding, number: number, appDirectory: string): AppSecurityFinding {
  const common = {
    number,
    disposition: finding.disposition,
    location: projectLocation(finding.location, appDirectory),
    message: finding.message,
    snippet: projectOptionalText(finding.snippet),
    evidence: finding.evidence.map((evidence) => projectEvidence(evidence, appDirectory)),
    suppression: projectFindingSuppression(finding.suppressed_by),
  }
  if (finding.source === 'deterministic') {
    return {
      source: 'deterministic',
      ...common,
      fix: finding.fix
        ? {
            description: finding.fix.description,
            guide: projectOptionalText(finding.fix.guide),
            automated: finding.fix.automated,
          }
        : null,
    }
  }
  return {
    source: 'agent',
    ...common,
    confidence: finding.confidence ?? null,
    reasoning: projectOptionalText(finding.reasoning),
  }
}

/**
 * What suppresses a finding: `suppressed_by`, which the combination sets only for an entry that matched the finding or
 * for the agent's own suppression of an agent finding. A hand-edited `suppression` on a deterministic finding has none.
 */
function projectFindingSuppression(suppression: FindingSuppression | undefined): AppSecurityFindingSuppression {
  if (suppression === undefined) return null
  if (suppression.origin === 'agent') return {justification: suppression.reason, origin: 'agent'}
  return {
    justification: suppression.reason,
    origin: 'file',
    entryIndex: suppression.entry_index,
    kind: suppression.kind,
  }
}

function projectEvidence(evidence: StoredEvidence, appDirectory: string): AppSecurityFinding['evidence'][number] {
  return {location: projectLocation(evidence.location, appDirectory), quote: projectOptionalText(evidence.quote)}
}
