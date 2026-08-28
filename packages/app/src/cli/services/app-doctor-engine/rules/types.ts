import type {Issue, Capabilities, Severity} from '../types.js'

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
  /** Contents of shopify.app.toml (parsed), or null if not found */
  appToml: AppTomlContent | null
  /** All extension config files found */
  extensions: ExtensionInfo[]
  /** All source files found (JS, TS, Liquid, PHP, Ruby, Python) */
  sourceFiles: SourceFile[]
  /** Package manifest files found (package.json, Gemfile, composer.json) */
  manifests: ManifestFile[]
  /** Detected capabilities */
  capabilities: Capabilities
}

export interface AppTomlContent {
  /** Raw parsed TOML object */
  raw: Record<string, unknown>
  /** Path to the file */
  path: string
  /** The scopes string, if present */
  scopes?: string
  /** Redirect URLs */
  redirect_urls?: string[]
  /** Webhook subscriptions */
  webhooks?: WebhookSubscription[]
  /** IP allowlist entries, if declared */
  ip_allowlist?: string[]
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
  type: 'npm' | 'ruby' | 'php'
  /** Parsed dependencies, keyed by name with version specifications as values. */
  dependencies: Record<string, string>
  devDependencies?: Record<string, string>
}
