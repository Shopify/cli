import type {Issue, Capabilities, ProjectDetection, Severity, SourceCandidate} from '../types.js'

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

export interface AppTomlContent {
  /** Raw parsed TOML object */
  raw: Record<string, unknown>
  /** Path to the file */
  path: string
  /** Exact bytes decoded for parsing and hashing. */
  content?: string
  /** The scopes string, if present. */
  scopes?: string
  /** API version selected by this configuration. */
  apiVersion?: string
  /** OAuth redirect URLs. */
  redirectUrls: string[]
  /** Webhook subscriptions. */
  webhooks: WebhookSubscription[]
}

export interface WebhookSubscription {
  topics: string[]
  uri: string
}

export interface ExtensionInfo {
  /** Path to shopify.extension.toml */
  path: string
  /** Extension type, e.g. "theme_app_extension" */
  type: string
  /** Exact configuration bytes decoded for parsing and hashing. */
  content?: string
  /** All files in the extension directory */
  files: SourceFile[]
}

export interface SourceFile {
  /** Project-relative path */
  path: string
  /** Absolute path */
  absolutePath: string
  /** File extension */
  ext: string
  /** File contents (read lazily where possible) */
  content?: string
}

export interface ManifestFile {
  path: string
  absolutePath: string
  type: 'npm'
  /** Exact manifest bytes decoded for parsing and hashing. */
  content?: string
  /** Parsed dependencies, keyed by name with version specifications as values. */
  dependencies: Record<string, string>
  devDependencies?: Record<string, string>
  /** packageManager declared by package.json, for example pnpm version 10. */
  packageManager?: string
}
