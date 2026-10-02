export interface Issue {
  id: string
  /** Detector-defined variant within a rule, used to group similar findings in the report. */
  pattern_id?: string
  severity: Severity
  points: number
  title: string
  message: string
  location: Location
  snippet?: string
  fix: Fix
  confidence?: Confidence
  rule_version?: number
  evidence?: FindingEvidence[]
  detection_evidence?: string[]
}

export type Severity = 'high' | 'medium' | 'low'

/**
 * The single severity ranking: a higher number is more severe. Use it for blocking thresholds
 * (`SEVERITY_RANK[a] >= SEVERITY_RANK[b]`) and for sorting most severe first.
 */
export const SEVERITY_RANK: Record<Severity, number> = {high: 3, medium: 2, low: 1}

export type Confidence = 'definite' | 'needs_review'

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
  embedded_app: boolean
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

/** What to scan, already resolved: the engine doesn't look for an app directory or choose a configuration. */
export interface ScanInput {
  appDirectory: string
  /** Absolute path of the selected app configuration file. Absent when scanning without app configuration. */
  appConfigFilePath?: string
  clientId?: string
}

export interface ScanOptions {
  ignorePatterns?: ReadonlyArray<string>
}

/** Git state of an app root. Display only: nothing compares it with the current source. */
export interface ProjectState {
  commit: string | null
  dirty: boolean | null
}

export interface ScanResult {
  version: string
  timestamp: string
  project: ProjectState
  app: {
    name: string
    type: string
  }
  capabilities: Capabilities
  detection: ProjectDetection
  scan: ScanMetadata
  issues: Issue[]
}

export interface SkippedFile {
  path: string
  reason: 'too_large' | 'unreadable'
  size_bytes?: number
  detail?: string
}

export type CheckExecutionKind = 'deterministic'
export type CheckExecutionStatus = 'executed' | 'not_applicable' | 'unsupported_framework' | 'unresolved'
export type AnalysisMode = 'regex' | 'structured_config' | 'ast'

export type CheckExecutionReasonCode =
  | 'capability_absent'
  | 'no_relevant_files'
  | 'unsupported_framework'
  | 'unsupported_language'
  | 'parser_unavailable'
  | 'agent_investigation_required'
  | 'input_rejected'

export interface CheckExecutionReason {
  code: CheckExecutionReasonCode
  message: string
}

export interface CheckExecution {
  /** Stable product check ID. Implementations are distinguished by kind and runner identity. */
  id: string
  version: number
  kind: CheckExecutionKind
  status: CheckExecutionStatus
  applicable: boolean
  languages: string[]
  framework: DetectedFramework
  surface: DetectedSurface
  inspected_files: string[]
  findings: number
  analysis_mode: AnalysisMode
  reason?: CheckExecutionReason
}

export interface CoverageGap {
  code: 'skipped_file' | 'unsupported_framework' | 'unsupported_language' | 'unresolved_check'
  message: string
  check_id?: string
  file?: string
}

export interface ScanMetadata {
  timestamp: string
  security_version: string
  files_scanned: number
  rules_run: number
  rules_skipped: number
  files_skipped_count: number
  files_skipped?: SkippedFile[]
  coverage_gaps: CoverageGap[]
  checks_executed: CheckExecution[]
}

/** Schema version shared by deterministic-findings.json and agent-findings.json. */
export const FINDINGS_SCHEMA_VERSION = 1 as const
export const AGENT_CHECKS_SCHEMA_VERSION = 1 as const
/** Schema version of the findings document an agent pipes to `app security record`. */
export const RECORD_INPUT_SCHEMA_VERSION = 1 as const
export const ENGINE_NAME = 'shopify-app-security' as const

export interface FindingEvidence {
  location: Location
  quote?: string
}

/**
 * The converged stored schema (§3). Both result files share it, discriminated on `source`:
 * `check` writes a DeterministicFindingsDocument and `record` writes an AgentFindingsDocument.
 */
export type FindingsSource = 'deterministic' | 'agent'
export type StoredCheckStatus = 'executed' | 'not_applicable' | 'unresolved'
export type CheckPrecedence = 'union' | 'prefer-agent'

/** Check metadata copied when the file is written, so it never needs the current catalog to be displayed. */
export interface CheckSnapshot {
  title: string
  severity: Severity
  description: string
  guide?: string
  /** Catalog version when the file was written. */
  current_version: number
  /** Agent documents only. Absent means 'union'. */
  precedence?: CheckPrecedence
}

/** Stored evidence has the same shape as the evidence an issue carries. */
export type StoredEvidence = FindingEvidence

/** One stored finding. Its severity and title live on the check's snapshot. All text is redacted. */
export interface StoredFinding {
  location: Location
  message: string
  evidence: StoredEvidence[]
  snippet?: string
  /** Deterministic documents only. */
  fix?: Fix
  /** Agent documents only. */
  confidence?: 'high' | 'medium' | 'low'
  /** Agent documents only. */
  reasoning?: string
  /** Agent documents only. */
  suppression?: {justification: string}
}

export interface StoredCheck {
  id: string
  /** Deterministic: the catalog version. Agent: the version the agent claimed, never compared with the catalog. */
  version: number
  status: StoredCheckStatus
  reason?: {code: string; message: string}
  /** Deterministic documents only. */
  analysis_mode?: AnalysisMode
  snapshot: CheckSnapshot
  findings: StoredFinding[]
}

interface FindingsDocumentBase {
  schema_version: typeof FINDINGS_SCHEMA_VERSION
  /** ISO time the file was written. */
  generated_at: string
  project: ProjectState
  checks: StoredCheck[]
}

/** deterministic-findings.json: the deterministic results of one `app security check` run. */
export interface DeterministicFindingsDocument extends FindingsDocumentBase {
  source: 'deterministic'
  engine: {name: typeof ENGINE_NAME; version: string; ruleset: string}
  detection: ProjectDetection
  coverage: {files_scanned: number; files_skipped: SkippedFile[]; gaps: CoverageGap[]}
}

/** agent-findings.json: the validated agentic results written by `app security record`. */
export interface AgentFindingsDocument extends FindingsDocumentBase {
  source: 'agent'
  engine: {name: typeof ENGINE_NAME; version: string}
}

export type FindingsDocument = DeterministicFindingsDocument | AgentFindingsDocument

/*
 * Shapes of the findings document an agent pipes to `app security record` (RECORD_INPUT_SCHEMA_VERSION).
 * `record` validates and redacts them into an AgentFindingsDocument; they are never stored as-is.
 */

/** The status an agent may claim for a check. The scanner-only `unsupported_framework` is not one of them. */
export type AgentCheckStatus = Extract<CheckExecutionStatus, 'executed' | 'not_applicable' | 'unresolved'>

/** Why an agent check is unresolved or not applicable, in the agent's words (redacted). */
export interface AgentCheckReason {
  code: string
  message: string
}

/** Evidence as the agent reports it: a flat file and line, unlike the stored `StoredEvidence.location`. */
export interface AgentFindingEvidence {
  file: string
  line?: number
  quote?: string
}
