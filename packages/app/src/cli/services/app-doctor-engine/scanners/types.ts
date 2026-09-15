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

/** Explicitly allowlisted CI configuration inside the app-root evidence boundary. */
export interface DependencyAuditingInputs {
  files: SourceFile[]
  /** A specific discovery obstacle, including an app nested below its repository root. */
  unresolvedReason?: string
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
  /** Literal package scripts; only one CI-invoked script reference is followed. */
  scripts?: Record<string, string>
}
