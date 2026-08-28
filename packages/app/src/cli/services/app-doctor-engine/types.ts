/**
 * A single security finding produced by a rule.
 */
export interface Issue {
  /** Stable rule identifier, e.g. "DEPRECATED_SCRIPT_TAG_SCOPE" */
  id: string
  /** "critical" | "high" | "medium" | "low" */
  severity: Severity
  /** Points deducted from the baseline score */
  points: number
  /** Short human-readable headline */
  title: string
  /** Longer explanation of what was found */
  message: string
  /** Where the issue was found */
  location: Location
  /** Code snippet (optional) */
  snippet?: string
  /** How to fix it */
  fix: Fix
  /** Confidence level: "definite" affects the score; others are advisory */
  confidence?: Confidence
  /**
   * Who found this issue. "static" = a deterministic rule; "agent" = an
   * agentic check prompt. Agentic findings carry the check version and prompt
   * hash so a verdict is traceable to the exact wording that produced it.
   */
  found_by?: 'static' | 'agent' | 'external'
  /** Version of the deterministic rule or external producer rule. */
  rule_version?: number
  /** Redacted citations supporting an agent or external finding. */
  evidence?: FindingEvidence[]
  /** Which agentic check found this (agent findings only). */
  check_version?: number
  prompt_hash?: string
  /** The agent's stated confidence in its own finding. */
  agent_confidence?: 'high' | 'medium' | 'low'
  /** The agent's reasoning for why this is a real issue. */
  agent_reasoning?: string
  /**
   * How the rule established this finding — e.g. the git commands consulted
   * and their verdicts. Lets a reviewer see WHY a severity was chosen rather
   * than taking the rule's word for it, and makes fail-closed decisions
   * ("could not determine, treated as exposed") visible in the trace.
   */
  detection_evidence?: string[]
}

export type Severity = 'critical' | 'high' | 'medium' | 'low'

/**
 * Confidence level for a finding.
 * - "definite": a deterministic rule matched a provable pattern. Affects the score.
 * - "needs_review": heuristic or context-dependent. Used internally by rules that
 *   have mixed definite/needs_review paths. Filtered out of the trace by scan().
 * - "agentic": found by an agent running a semantic check prompt. Advisory
 *   until a human or Shopify confirms, but carries more weight than a
 *   heuristic guess because the agent read the surrounding code.
 * Defaults to "definite" when omitted for backward compatibility.
 */
export type Confidence = 'definite' | 'needs_review' | 'agentic'

export interface Location {
  /** Project-relative file path */
  file: string
  /** 1-indexed line number (optional for config-level checks) */
  line?: number
  /** 1-indexed column number */
  column?: number
}

export interface Fix {
  /** Can this be fixed automatically? */
  automated: boolean
  /** URL to documentation for manual fix */
  guide?: string
  /** Short text description of the fix */
  description: string
}

/**
 * What the app does — auto-detected to skip irrelevant checks.
 */
export interface Capabilities {
  theme_app_extension: boolean
  app_embed: boolean
  script_tags: boolean
  webhooks: boolean
  app_proxy: boolean
  storefront_metafield_writes: boolean
  has_backend: boolean
  declared_ip_allowlist: boolean
  checkout_extension: boolean
}

/**
 * The full scan result.
 */
export interface ScanResult {
  version: string
  timestamp: string
  /** Best-effort local git identity. null means unavailable, never "clean". */
  project: {
    commit: string | null
    dirty: boolean | null
  }
  app: {
    name: string
    type: string
  }
  capabilities: Capabilities
  score: ScoreResult
  scan: ScanMetadata
  issues: Issue[]
}

export interface ScoreResult {
  total: number
  baseline: number
  grade: Grade
}

export type Grade = 'EXCELLENT' | 'GOOD' | 'NEEDS_WORK' | 'CRITICAL'

/**
 * A file that was discovered but never analyzed. Recorded explicitly because
 * an unscanned file is not a clean file, and a reviewer reading the trace must
 * be able to tell the difference.
 */
export interface SkippedFile {
  path: string
  reason: 'too_large' | 'unreadable'
  size_bytes?: number
  detail?: string
}

export interface ScanMetadata {
  timestamp: string
  doctor_version: string
  files_scanned: number
  rules_run: number
  rules_skipped: number
  /** Files discovered but not analyzed. Non-zero means coverage is incomplete. */
  files_skipped_count: number
  /** Detail for each skipped file, present only when some were skipped. */
  files_skipped?: SkippedFile[]
  /** SHA-256 of concatenated file content hashes — lets platform verify what was scanned */
  input_hash: string
  /** SHA-256 of canonical issues+score JSON — lets platform verify output integrity */
  result_hash: string
  /** Per-file SHA-256, keyed by project-relative path. Enables staleness detection. */
  file_hashes?: Record<string, string>
  /** Deterministic checks attempted, including checks that found nothing. */
  checks_executed?: CheckExecution[]
}

export const TRACE_SCHEMA_VERSION = 1 as const
export const SUPPORTED_TRACE_SCHEMA_VERSIONS = [TRACE_SCHEMA_VERSION] as const
export const ENGINE_NAME = 'shopify-app-doctor' as const

export type FindingSource = 'deterministic' | 'agent' | 'external'

export interface FindingEvidence {
  location: Location
  quote?: string
}

export interface CheckExecution {
  id: string
  version: number
  kind: 'rule' | 'check' | 'external'
  status: 'executed' | 'skipped'
  findings: number
  prompt_hash?: string
  reason?: string
}

export interface SuppressionProvenance {
  source: 'human' | 'policy' | 'external'
  actor?: string
  created_at: string
}

export interface Suppression {
  id: string
  finding_fingerprint: string
  justification: string
  provenance: SuppressionProvenance
}

export interface TraceFinding {
  fingerprint: string
  source: FindingSource
  rule_id?: string
  rule_version?: number
  check_id?: string
  check_version?: number
  prompt_hash?: string
  severity: Severity
  title: string
  message: string
  location: Location
  evidence: FindingEvidence[]
  snippet?: string
  fix: Fix
  suppressed: boolean
  suppression?: {
    id: string
    justification: string
    provenance: SuppressionProvenance
  }
}

export interface TraceV1 {
  schema_version: typeof TRACE_SCHEMA_VERSION
  engine: {
    name: typeof ENGINE_NAME
    version: string
    ruleset: string
  }
  generated_at: string
  project: {
    commit: string | null
    dirty: boolean | null
    input_hash: string
    input_hashes: Record<string, string>
  }
  findings: TraceFinding[]
  checks_executed: CheckExecution[]
  suppressions: Suppression[]
  coverage: {
    files_scanned: number
    files_skipped: SkippedFile[]
    complete: boolean
  }
  attestation: {
    digest: string
    signed: false
  }
}
