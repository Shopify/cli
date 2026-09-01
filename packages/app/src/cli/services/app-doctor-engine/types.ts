export interface Issue {
  id: string
  severity: Severity
  points: number
  title: string
  message: string
  location: Location
  snippet?: string
  fix: Fix
  confidence?: Confidence
  found_by?: 'static' | 'agent' | 'external'
  rule_version?: number
  evidence?: FindingEvidence[]
  check_version?: number
  prompt_hash?: string
  agent_confidence?: 'high' | 'medium' | 'low'
  agent_reasoning?: string
  detection_evidence?: string[]
}

export type Severity = 'high' | 'medium' | 'low'

export type Confidence = 'definite' | 'needs_review' | 'agentic'

export interface Location {
  file: string
  line?: number
  column?: number
}

export interface Fix {
  automated: boolean
  guide?: string
  description: string
}

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

export type DetectedFramework = 'react_router' | 'none' | 'unknown' | 'mixed'
export type DetectedSurface = 'react_router' | 'theme_app_extension' | 'config_only' | 'unknown' | 'mixed'
export type LanguageSupport = 'supported' | 'unsupported'

export interface SourceCandidate {
  path: string
  extension: string
  language: string
  supported: boolean
}

export interface DetectedLanguage {
  name: string
  support: LanguageSupport
  files: string[]
}

export interface ProjectDetection {
  framework: DetectedFramework
  surface: DetectedSurface
  languages: DetectedLanguage[]
}

export interface ScanResult {
  version: string
  timestamp: string
  project: {
    commit: string | null
    dirty: boolean | null
  }
  app: {
    name: string
    type: string
  }
  capabilities: Capabilities
  detection: ProjectDetection
  /** Null means the deterministic coverage is insufficient to grade safely. */
  score: ScoreResult | null
  scan: ScanMetadata
  issues: Issue[]
}

export interface ScoreResult {
  total: number
  baseline: number
  grade: Grade
}

export type Grade = 'EXCELLENT' | 'GOOD' | 'NEEDS_WORK' | 'POOR'

export interface SkippedFile {
  path: string
  reason: 'too_large' | 'unreadable'
  size_bytes?: number
  detail?: string
}

export type CheckExecutionKind = 'deterministic' | 'agent' | 'external'
export type CheckExecutionStatus = 'executed' | 'not_applicable' | 'unsupported_framework' | 'unresolved'
export type AnalysisMode = 'regex' | 'structured_config' | 'audit' | 'ast' | 'agent' | 'external'

export type CheckExecutionReasonCode =
  | 'capability_absent'
  | 'no_relevant_files'
  | 'unsupported_framework'
  | 'unsupported_language'
  | 'parser_unavailable'
  | 'audit_unavailable'
  | 'agent_investigation_required'
  | 'not_reported'
  | 'input_rejected'

export interface CheckExecutionReason {
  code: CheckExecutionReasonCode
  message: string
}

export interface CheckImplementationExecution {
  /** Stable runner identity within a product check. */
  id: string
  analysis_mode: AnalysisMode
  status: CheckExecutionStatus
  inspected_files: string[]
  findings: number
  reason?: CheckExecutionReason
}

export interface CheckExecution {
  /** Stable product check ID. Implementations are distinguished by kind and runner identity. */
  id: string
  version: number
  kind: CheckExecutionKind
  status: CheckExecutionStatus
  required: boolean
  applicable: boolean
  languages: string[]
  framework: DetectedFramework
  surface: DetectedSurface
  inspected_files: string[]
  findings: number
  analysis_mode: AnalysisMode
  reason?: CheckExecutionReason
  /** Exact semantic prompt and handoff guidance for agent implementations. */
  prompt?: string
  guidance?: string
  prompt_hash?: string
  /** Deterministic runner provenance when one product check has multiple implementations. */
  implementations?: CheckImplementationExecution[]
}

export interface CoverageGap {
  code: 'skipped_file' | 'unsupported_framework' | 'unsupported_language' | 'unresolved_check'
  message: string
  check_id?: string
  file?: string
}

export interface ScanMetadata {
  timestamp: string
  doctor_version: string
  files_scanned: number
  rules_run: number
  rules_skipped: number
  files_skipped_count: number
  files_skipped?: SkippedFile[]
  coverage_complete: boolean
  coverage_gaps: CoverageGap[]
  input_hash: string
  result_hash: string
  file_hashes?: Record<string, string>
  checks_executed: CheckExecution[]
}

/** Trace v1 is retained as a legacy type. Its shape is intentionally frozen. */
export interface TraceV1 {
  schema_version: 1
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
  checks_executed: LegacyCheckExecution[]
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

interface LegacyCheckExecution {
  id: string
  version: number
  kind: 'rule' | 'check' | 'external'
  status: 'executed' | 'skipped'
  findings: number
  prompt_hash?: string
  reason?: string
}

export const TRACE_SCHEMA_VERSION = 2 as const
export const SUPPORTED_TRACE_SCHEMA_VERSIONS = [TRACE_SCHEMA_VERSION] as const
export const ENGINE_NAME = 'shopify-app-doctor' as const

export type FindingSource = 'deterministic' | 'agent' | 'external'

export interface FindingEvidence {
  location: Location
  quote?: string
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

export interface TraceV2 {
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
  detection: ProjectDetection
  score: ScoreResult | null
  findings: TraceFinding[]
  checks_executed: CheckExecution[]
  suppressions: Suppression[]
  coverage: {
    files_scanned: number
    files_skipped: SkippedFile[]
    complete: boolean
    gaps: CoverageGap[]
  }
  attestation: {
    digest: string
    signed: false
  }
}
