import type {Issue, Capabilities, ProjectDetection, Severity, SourceCandidate} from '../types.js'
import type {GatheredListingStatus} from '../scanners/path-rules.js'
import type {
  AppTomlContent,
  DependencyAutomationInputs,
  ExtensionInfo,
  ManifestFile,
  SourceFile,
} from '../scanners/types.js'

export type {AppTomlContent, ExtensionInfo, ManifestFile, SourceFile} from '../scanners/types.js'

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
  /** Supported JavaScript package manifests found. */
  manifests: ManifestFile[]
  /** Local dependency-management configuration and discovery obstacles. */
  dependencyAutomation: DependencyAutomationInputs
  /** Safely readable repository text evidence available to secret scanning. */
  sensitiveFiles: SourceFile[]
  /** Detected capabilities */
  capabilities: Capabilities
  /** Framework, surface, and language inventory. */
  detection: ProjectDetection
  /** React Router app roots relative to the app root, with `.` for the app root. Empty unless the framework is React Router. */
  reactRouterRoots: string[]
  /** Other apps' directories relative to the app root, with forward slashes. */
  otherAppDirectories: string[]
  /** Path-only inventory, including unsupported source candidates. */
  sourceCandidates: SourceCandidate[]
  /** Outcome of listing git's ignored paths for the first scan directory. */
  gitIgnoreListing: GatheredListingStatus
}
