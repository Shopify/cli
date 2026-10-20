import {appSecurityReviewJsonOutputSchema, type AppSecurityReviewResult} from './types.js'
import {
  projectAppSecurityApp,
  projectAppSecurityBlocking,
  projectAppSecurityPath,
  projectAppSecurityRelativePath,
  projectAppSecurityScanDirectory,
  projectAppSecurityScope,
} from '../app-security-json-output.js'
import {renderSecurityReview} from '../security-review-output.js'
import {formatJsonOutputTimestamp, jsonOutputTimestampSchema} from '@shopify/cli-kit/node/json-output-schema'
import {outputResult} from '@shopify/cli-kit/node/output'
import type {
  CheckPrecedence,
  CombinedCheck,
  CombinedFinding,
  DeterministicFindingsDocument,
  Severity,
  SourceCheckResult,
  StoredCheckStatus,
  StoredEvidence,
  StoredFinding,
} from '../app-security-engine/index.js'
import type {ReviewedAppSecurityResults, SecurityReviewResult} from '../security-review.js'

type AppSecurityCheck = AppSecurityReviewResult['checks'][number]
type AppSecurityFinding = AppSecurityCheck['findings'][number]
type AppSecurityAgentFinding = Extract<AppSecurityFinding, {source: 'agent'}>
type AppSecuritySourceResult = NonNullable<AppSecurityCheck['bySource']['deterministic']>
type AppSecurityLocation = AppSecurityFinding['location']
type AppSecurityDetection = NonNullable<AppSecurityReviewResult['detection']>
type AppSecurityCoverage = NonNullable<AppSecurityReviewResult['coverage']>
type AppSecurityResultsFiles = AppSecurityReviewResult['resultsFiles']

type StoredDetection = DeterministicFindingsDocument['detection']
type StoredCoverage = DeterministicFindingsDocument['coverage']

/*
 * The stored values of each closed enum, mapped to their public values. A new stored value fails to compile until
 * it is mapped.
 */
const SEVERITIES: Record<Severity, AppSecurityCheck['severity']> = {high: 'high', medium: 'medium', low: 'low'}
const CHECK_STATUSES: Record<StoredCheckStatus, AppSecurityCheck['status']> = {
  executed: 'executed',
  not_applicable: 'not-applicable',
  unresolved: 'unresolved',
}
const PRECEDENCES: Record<CheckPrecedence, AppSecurityCheck['precedence']> = {
  union: 'union',
  'prefer-agent': 'prefer-agent',
}
const DISPOSITIONS: Record<CombinedFinding['disposition'], AppSecurityFinding['disposition']> = {
  active: 'active',
  suppressed: 'suppressed',
  superseded: 'superseded',
}
const CONFIDENCES: Record<
  NonNullable<StoredFinding['confidence']>,
  NonNullable<AppSecurityAgentFinding['confidence']>
> = {high: 'high', medium: 'medium', low: 'low'}
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
const LANGUAGE_SUPPORT: Record<
  StoredDetection['languages'][number]['support'],
  AppSecurityDetection['languages'][number]['support']
> = {supported: 'supported', unsupported: 'unsupported'}
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
    renderSecurityReview({result: review.result, verbose: options.verbose, now: new Date(), commands: review.commands})
  }

  if (review.result.blocking.blockedChecks > 0) process.exitCode = 1
}

function appSecurityReviewResult({selection, result}: ReviewedAppSecurityResults): AppSecurityReviewResult {
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
    checks: result.checks.map((check) => projectCheck(check, appDirectory)),
    blocking: projectAppSecurityBlocking(result.blocking),
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
      support: LANGUAGE_SUPPORT[language.support],
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

function projectCheck(check: CombinedCheck, appDirectory: string): AppSecurityCheck {
  return {
    id: check.id,
    title: check.title,
    severity: SEVERITIES[check.severity],
    description: check.description,
    guide: projectOptionalText(check.guide),
    docsUrl: check.docs_url ?? null,
    precedence: PRECEDENCES[check.precedence],
    appliedPrecedence: PRECEDENCES[check.applied_precedence],
    status: CHECK_STATUSES[check.status],
    bySource: {
      deterministic: check.by_source.deterministic ? projectSourceResult(check.by_source.deterministic) : null,
      agent: check.by_source.agent ? projectSourceResult(check.by_source.agent) : null,
    },
    findings: check.findings.map((finding) => projectFinding(finding, appDirectory)),
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
function projectFinding(finding: CombinedFinding, appDirectory: string): AppSecurityFinding {
  const common = {
    disposition: DISPOSITIONS[finding.disposition],
    location: projectLocation(finding.location, appDirectory),
    message: finding.message,
    snippet: projectOptionalText(finding.snippet),
    evidence: finding.evidence.map((evidence) => projectEvidence(evidence, appDirectory)),
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
    confidence: finding.confidence ? CONFIDENCES[finding.confidence] : null,
    reasoning: projectOptionalText(finding.reasoning),
    suppression: finding.suppression ? {justification: finding.suppression.justification} : null,
  }
}

function projectEvidence(evidence: StoredEvidence, appDirectory: string): AppSecurityFinding['evidence'][number] {
  return {location: projectLocation(evidence.location, appDirectory), quote: projectOptionalText(evidence.quote)}
}
