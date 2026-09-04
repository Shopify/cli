import type {Issue, Capabilities, ProjectDetection, Severity, SourceCandidate} from '../types.js'
import type {AppTomlContent, ExtensionInfo, ManifestFile, SourceFile} from '../scanners/types.js'

export type {AppTomlContent, ExtensionInfo, ManifestFile, SourceFile} from '../scanners/types.js'

export interface AuditCommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

export type AuditExecutor = (
  command: string,
  args: string[],
  options: {cwd: string; signal: AbortSignal; env: Record<string, string | undefined>},
) => Promise<AuditCommandResult>

/**
 * A rule defines:
 * - Which capability gates it (skip if not applicable)
 * - How to check for the issue
 * - How many points to deduct
 */
export interface Rule {
  /** Stable identifier, e.g. "DEPRECATED_SCRIPT_TAG_SCOPE" */
  id: string
  /** Human-readable title */
  title: string
  /** Default severity */
  severity: Severity
  /** Points deducted when this rule fires */
  points: number
  /** Which capability must be true for this rule to run. undefined = always runs. */
  requires?: keyof Capabilities
  /** The check function */
  check: (context: ScanContext) => Issue[]
}

/**
 * Context passed to every rule's check function.
 */
export interface ScanContext {
  /** Absolute path to the app root directory */
  appRoot: string
  /** Selected app configuration, or null if none was readable. */
  appToml: AppTomlContent | null
  /** All readable app configurations inspected by config rules. */
  appTomls: AppTomlContent[]
  /** All extension config files found */
  extensions: ExtensionInfo[]
  /** Source files read for supported non-secret deterministic analysis. */
  sourceFiles: SourceFile[]
  /** Package manifest files found (package.json, Gemfile, composer.json) */
  manifests: ManifestFile[]
  /** Safely readable repository text evidence available to secret scanning. */
  sensitiveFiles: SourceFile[]
  /** Detected capabilities */
  capabilities: Capabilities
  /** Framework, surface, and language inventory. */
  detection: ProjectDetection
  /** Path-only inventory, including unsupported source candidates. */
  sourceCandidates: SourceCandidate[]
  /** Test seam for running audits without invoking a package-manager process. */
  dependencyAuditExecutor?: AuditExecutor
}
