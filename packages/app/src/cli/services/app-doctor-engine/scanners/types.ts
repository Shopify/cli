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
