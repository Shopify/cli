import {canonicalJson, sha256} from '../trace/index.js'
import {getEngineVersion} from '../version.js'
import type {CheckExecution, Issue, ScoreResult, Grade, ScanMetadata, Capabilities, SkippedFile} from '../types.js'

const BASELINE = 70

interface BonusRule {
  id: string
  points: number
  test: (capabilities: Capabilities, issues: Issue[]) => boolean
}

// Bonus points for good security practices.
// These let a well-configured app score above 85.
const BONUS_RULES: BonusRule[] = [
  {
    id: 'BONUS_NO_SCRIPT_TAGS',
    points: 5,
    test: (caps) => !caps.script_tags,
  },
  {
    id: 'BONUS_CURRENT_SDK',
    points: 5,
    test: (_caps, issues) => !issues.some((i) => i.id === 'OUTDATED_SHOPIFY_SDK'),
  },
  {
    id: 'BONUS_NO_SECRETS',
    points: 10,
    test: (_caps, issues) => !issues.some((i) => i.id === 'COMMITTED_SECRET'),
  },
]

export function calculateScore(issues: Issue[], capabilities: Capabilities): ScoreResult {
  let total = BASELINE

  // Apply deductions — only for definite findings.
  // needs_review and agentic findings are advisory and do NOT affect the score.
  for (const issue of issues) {
    if (issue.confidence !== 'definite' && issue.confidence !== undefined) continue
    total += issue.points
  }

  // Apply bonuses — only check definite findings for bonus eligibility.
  // An advisory finding shouldn't withhold a bonus.
  for (const bonus of BONUS_RULES) {
    const definiteIssues = issues.filter((i) => i.confidence === 'definite' || i.confidence === undefined)
    if (bonus.test(capabilities, definiteIssues)) {
      total += bonus.points
    }
  }

  total = Math.max(0, Math.min(100, total))

  return {
    total,
    baseline: BASELINE,
    grade: scoreToGrade(total),
  }
}

function scoreToGrade(score: number): Grade {
  if (score >= 90) return 'EXCELLENT'
  if (score >= 75) return 'GOOD'
  if (score >= 60) return 'NEEDS_WORK'
  return 'CRITICAL'
}

export function computeResultHash(issues: Issue[], score: ScoreResult): string {
  const canonicalIssues = issues
    .map((issue) => ({
      id: issue.id,
      source: issue.found_by ?? 'static',
      rule_version: issue.rule_version ?? (issue.found_by === 'agent' ? null : 1),
      check_version: issue.check_version ?? null,
      prompt_hash: issue.prompt_hash ?? null,
      severity: issue.severity,
      points: issue.points,
      title: issue.title,
      message: issue.message,
      location: issue.location,
      snippet: issue.snippet ?? null,
      evidence: issue.evidence ?? [],
      fix: issue.fix,
    }))
    .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)))
  return sha256({issues: canonicalIssues, score})
}

export function computeScanMetadata(
  filesScanned: number,
  rulesRun: number,
  rulesSkipped: number,
  issues: Issue[],
  score: ScoreResult,
  fileHashMap?: Record<string, string>,
  filesSkipped?: SkippedFile[],
  checksExecuted?: CheckExecution[],
): ScanMetadata {
  const inputs = {
    files: Object.entries(fileHashMap ?? {}).sort(([left], [right]) => left.localeCompare(right)),
    skipped: [...(filesSkipped ?? [])].sort((left, right) => left.path.localeCompare(right.path)),
  }
  return {
    timestamp: new Date().toISOString(),
    doctor_version: getEngineVersion(),
    files_scanned: filesScanned,
    rules_run: rulesRun,
    rules_skipped: rulesSkipped,
    // Surfaced so a reviewer can tell "clean" apart from "never looked".
    files_skipped_count: filesSkipped?.length ?? 0,
    files_skipped: filesSkipped && filesSkipped.length > 0 ? filesSkipped : undefined,
    input_hash: sha256(inputs),
    result_hash: computeResultHash(issues, score),
    file_hashes: fileHashMap,
    checks_executed: checksExecuted,
  }
}
