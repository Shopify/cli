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

export const DETERMINISTIC_FINDINGS_SCHEMA_VERSION = 1 as const
export const AGENT_CHECKS_SCHEMA_VERSION = 1 as const
export const ENGINE_NAME = 'shopify-app-security' as const

export interface FindingEvidence {
  location: Location
  quote?: string
}

/** A deterministic finding as stored in deterministic-findings.json. It carries everything needed to display it. */
export interface DeterministicFinding {
  rule_id: string
  rule_version: number
  severity: Severity
  title: string
  message: string
  location: Location
  evidence: FindingEvidence[]
  snippet?: string
  fix: Fix
}

/** A deterministic check execution as stored in deterministic-findings.json. */
export interface DeterministicCheckExecution {
  id: string
  version: number
  status: CheckExecutionStatus
  applicable: boolean
  analysis_mode: AnalysisMode
  findings: number
  reason?: CheckExecutionReason
}

/** deterministic-findings.json: the deterministic results of one `app security check` run. */
export interface DeterministicFindingsDocument {
  schema_version: typeof DETERMINISTIC_FINDINGS_SCHEMA_VERSION
  engine: {
    name: typeof ENGINE_NAME
    version: string
    ruleset: string
  }
  generated_at: string
  project: ProjectState
  detection: ProjectDetection
  findings: DeterministicFinding[]
  checks_executed: DeterministicCheckExecution[]
  coverage: {
    files_scanned: number
    files_skipped: SkippedFile[]
    gaps: CoverageGap[]
  }
}
