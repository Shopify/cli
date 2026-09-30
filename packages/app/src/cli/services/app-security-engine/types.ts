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
  /** Handoff guidance for checks that were unsupported or unresolved. */
  guidance?: string
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
  security_version: string
  files_scanned: number
  rules_run: number
  rules_skipped: number
  files_skipped_count: number
  files_skipped?: SkippedFile[]
  coverage_complete: boolean
  coverage_gaps: CoverageGap[]
  checks_executed: CheckExecution[]
}

export const TRACE_SCHEMA_VERSION = 3 as const
export const FINDINGS_SCHEMA_VERSION = 1 as const
export const SUPPORTED_TRACE_SCHEMA_VERSIONS = [TRACE_SCHEMA_VERSION] as const
export const ENGINE_NAME = 'shopify-app-security' as const

export interface FindingEvidence {
  location: Location
  quote?: string
}

export interface TraceFinding {
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

export interface TraceV3 {
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
  }
  detection: ProjectDetection
  findings: TraceFinding[]
  checks_executed: CheckExecution[]
  coverage: {
    files_scanned: number
    files_skipped: SkippedFile[]
    complete: boolean
    gaps: CoverageGap[]
  }
}
