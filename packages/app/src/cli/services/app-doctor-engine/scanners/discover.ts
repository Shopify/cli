import {AppAccessScopesSchema, AppAuthSchema} from '../../../models/extensions/specifications/app_config_app_access.js'
import {WebhookSubscriptionSchema} from '../../../models/extensions/specifications/app_config_webhook_schemas/webhook_subscription_schema.js'
import {fileExistsSync, fileSizeSync, globSync, readFileSync} from '@shopify/cli-kit/node/fs'
import {cwd, dirname, extname, joinPath, relativePath, resolvePath} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'
import {decodeToml} from '@shopify/cli-kit/node/toml/codec'
import {lstatSync} from 'node:fs'
import type {SourceCandidate} from '../types.js'
import type {AppTomlContent, ExtensionInfo, SourceFile, ManifestFile, WebhookSubscription} from './types.js'

/** Expected user error while locating a Shopify app root. */
export class AppRootDiscoveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppRootDiscoveryError'
  }
}

/**
 * Find the nearest app root without ever substituting CWD for a bad explicit path.
 *
 * This is intentionally not `Project.load()`. That loader also reads package,
 * environment, and hidden configuration, and it does not keep the bounded raw
 * bytes App Doctor hashes and reports as coverage. App Doctor reuses the same
 * `shopify.app*.toml` candidate shape, then reads those files through its own
 * repository boundary.
 */
export function findAppRoot(startPath?: string): string {
  const requestedPath = resolvePath(startPath ?? cwd())
  if (startPath && !fileExistsSync(requestedPath)) {
    throw new AppRootDiscoveryError(`App path does not exist: ${startPath}`)
  }

  let directory = requestedPath
  if (startPath && lstatSync(requestedPath).isFile()) {
    if (!requestedPath.endsWith('.toml')) {
      throw new AppRootDiscoveryError(`App path is not a directory or TOML file: ${startPath}`)
    }
    return dirname(requestedPath)
  }
  if (!lstatSync(directory).isDirectory()) {
    throw new AppRootDiscoveryError(`App path is not a directory: ${startPath ?? directory}`)
  }

  while (true) {
    const tomls = globSync('shopify.app*.toml', {
      cwd: directory,
      deep: 1,
      dot: false,
      onlyFiles: false,
      followSymbolicLinks: false,
    })
    if (tomls.length > 0) return directory

    const parent = dirname(directory)
    if (parent === directory) break
    directory = parent
  }

  throw new AppRootDiscoveryError(`Could not find a shopify.app*.toml from: ${startPath ?? cwd()}`)
}

/**
 * Find and parse all shopify.app.*.toml files in the app root.
 *
 * Candidate discovery matches `Project.load()`, but parsing stays on bounded
 * raw reads so unreadable files become coverage gaps instead of loader errors.
 */
export function findAppTomls(appRoot: string): AppTomlContent[] {
  const files = globSync('shopify.app*.toml', {
    cwd: appRoot,
    deep: 1,
    dot: false,
    onlyFiles: false,
    followSymbolicLinks: false,
  })

  return files.flatMap((file) => {
    const path = joinPath(appRoot, file)
    const content = readRepositoryText(appRoot, path)
    if (content === undefined) return []
    try {
      const raw = decodeToml(content) as Record<string, unknown>
      return [parseAppToml(raw, path, content, appRoot)]
      // Invalid repository TOML is a coverage gap, not a scanner crash.
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      recordSkippedFile(appRoot, path, {
        ok: false,
        reason: 'unreadable',
        detail: 'TOML could not be parsed',
      })
      return []
    }
  })
}

/**
 * Load a specific shopify.app.toml file.
 */
export function loadAppToml(tomlPath: string, appRoot = dirname(tomlPath)): AppTomlContent | null {
  const content = readRepositoryText(appRoot, tomlPath)
  if (content === undefined) return null
  try {
    const raw = decodeToml(content) as Record<string, unknown>
    return parseAppToml(raw, tomlPath, content, appRoot)
    // Invalid repository TOML is a coverage gap, not a scanner crash.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    recordSkippedFile(appRoot, tomlPath, {
      ok: false,
      reason: 'unreadable',
      detail: 'TOML could not be parsed',
    })
    return null
  }
}

const WebhooksSectionSchema = zod.object({
  api_version: zod.string().optional(),
  privacy_compliance: zod
    .object({
      customer_deletion_url: zod.string().optional(),
      customer_data_request_url: zod.string().optional(),
      shop_deletion_url: zod.string().optional(),
    })
    .optional(),
  subscriptions: zod.array(zod.unknown()).optional(),
})

const EvidenceWebhookSubscriptionSchema = zod.object({
  uri: zod.string(),
  topics: zod.array(zod.string()).optional(),
  compliance_topics: zod.array(zod.string()).optional(),
})

export function parseAppToml(
  raw: Record<string, unknown>,
  path: string,
  content?: string,
  appRoot?: string,
): AppTomlContent {
  const scopes = projectAccessScopes(raw.access_scopes, path, appRoot)
  const redirectUrls = projectRedirectUrls(raw.auth, path, appRoot)
  const webhooks = projectWebhooks(raw.webhooks, path, appRoot)

  return {
    raw,
    path,
    content,
    scopes,
    apiVersion: webhooks.apiVersion,
    redirectUrls,
    webhooks: webhooks.subscriptions,
  }
}

function projectAccessScopes(value: unknown, path: string, appRoot?: string): string | undefined {
  if (value === undefined) return undefined
  const parsed = AppAccessScopesSchema.safeParse(value)
  if (!parsed.success) {
    recordSectionGap(appRoot, path, 'access_scopes section could not be parsed')
    return undefined
  }
  const legacyScopes =
    parsed.data.scopes
      ?.split(/[\s,]+/)
      .filter(Boolean) ?? []
  const scopes = [...new Set([...legacyScopes, ...(parsed.data.required_scopes ?? [])])]
  return scopes.length > 0 ? scopes.join(',') : undefined
}

function projectRedirectUrls(value: unknown, path: string, appRoot?: string): string[] {
  if (value === undefined) return []
  const parsed = AppAuthSchema.safeParse(value)
  if (parsed.success) return parsed.data.redirect_urls

  const fallback = zod.object({redirect_urls: zod.array(zod.string())}).safeParse(value)
  if (!fallback.success) {
    recordSectionGap(appRoot, path, 'auth section could not be parsed')
    return []
  }
  return fallback.data.redirect_urls
}

function projectWebhooks(
  value: unknown,
  path: string,
  appRoot?: string,
): {apiVersion?: string; subscriptions: WebhookSubscription[]} {
  if (value === undefined) return {subscriptions: []}
  const parsed = WebhooksSectionSchema.safeParse(value)
  if (!parsed.success) {
    recordSectionGap(appRoot, path, 'webhooks section could not be parsed')
    return {subscriptions: []}
  }

  const webhookSubscriptions = (parsed.data.subscriptions ?? []).flatMap(projectWebhookSubscription)
  const privacyCompliance = parsed.data.privacy_compliance
  const privacyComplianceWebhooks = [
    {topic: 'customers/redact', uri: privacyCompliance?.customer_deletion_url},
    {topic: 'customers/data_request', uri: privacyCompliance?.customer_data_request_url},
    {topic: 'shop/redact', uri: privacyCompliance?.shop_deletion_url},
  ].flatMap(({topic, uri}): WebhookSubscription[] => (uri ? [{topics: [topic], uri}] : []))

  return {
    apiVersion: parsed.data.api_version,
    subscriptions: [...webhookSubscriptions, ...privacyComplianceWebhooks],
  }
}

function projectWebhookSubscription(value: unknown): WebhookSubscription[] {
  const strict = WebhookSubscriptionSchema.safeParse(value)
  if (strict.success) {
    return [
      {
        topics: [...(strict.data.topics ?? []), ...(strict.data.compliance_topics ?? [])],
        uri: strict.data.uri,
      },
    ]
  }

  const evidence = EvidenceWebhookSubscriptionSchema.safeParse(value)
  if (!evidence.success) return []
  return [
    {
      topics: [...(evidence.data.topics ?? []), ...(evidence.data.compliance_topics ?? [])],
      uri: evidence.data.uri,
    },
  ]
}

function recordSectionGap(appRoot: string | undefined, path: string, detail: string): void {
  if (!appRoot) return
  recordSkippedFile(appRoot, path, {ok: false, reason: 'unreadable', detail})
}

/**
 * Directories never worth scanning: build output, dependencies, and test
 * fixture trees.
 *
 * Patterns are generic on purpose. Earlier versions hardcoded the names of
 * this project's own fixture directories, which both leaked internal naming
 * into a tool that ships to third-party developers and silently skipped any
 * directory a developer happened to give the same name.
 *
 * Sub-apps (a nested directory with its own shopify.app.toml) are excluded
 * separately by callers, since that requires reading the tree rather than
 * matching a name.
 */
const IGNORED_DIRECTORIES = [
  '**/node_modules/**',
  '**/vendor/**',
  '**/.git/**',
  '**/.next/**',
  '**/coverage/**',
  '**/dist/**',
  '**/build/**',
  '**/.shopify/app-doctor/**',
  '**/test/**',
  '**/tests/**',
  '**/spec/**',
  '**/specs/**',
  '**/__tests__/**',
  '**/fixtures/**',
  '**/*-fixtures/**',
  '**/__fixtures__/**',
  '**/*.test.*',
  '**/*.spec.*',
]

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

/** Nested Shopify apps are independent scan roots and never evidence for their parent app. */
function findNestedAppDirectories(appRoot: string): string[] {
  return [
    ...new Set(
      globSync('**/shopify.app*.toml', {
        followSymbolicLinks: false,
        cwd: appRoot,
        ignore: IGNORED_DIRECTORIES,
        absolute: false,
        dot: false,
        onlyFiles: false,
      })
        .map((path) => normalizePath(dirname(path)))
        .filter((path) => path !== '.' && path.length > 0),
    ),
  ].sort()
}

function discoveryIgnores(directory: string, projectRoot: string): string[] {
  const nestedApps = findNestedAppDirectories(projectRoot).flatMap((nestedApp) => {
    const relativeNestedApp = normalizePath(relativePath(directory, joinPath(projectRoot, nestedApp)))
    return relativeNestedApp === '..' || relativeNestedApp.startsWith('../') ? [] : [`${relativeNestedApp}/**`]
  })
  return [...IGNORED_DIRECTORIES, ...nestedApps]
}

/**
 * Find extension-like repository content under the app root.
 *
 * `Project.load()` only considers paths in each app configuration's
 * `extension_directories`. App Doctor scans every `shopify.extension.toml`
 * inside the repository boundary, including unconfigured extensions, because
 * those files can still contain secrets, XSS, and other security evidence.
 * Nested apps, generated output, and test trees remain excluded.
 */
export function findExtensions(appRoot: string): ExtensionInfo[] {
  const extensionTomls = globSync('**/shopify.extension.toml', {
    followSymbolicLinks: false,
    cwd: appRoot,
    ignore: discoveryIgnores(appRoot, appRoot),
    absolute: false,
    dot: false,
    onlyFiles: false,
  })

  return extensionTomls.flatMap((tomlPath) => {
    const fullPath = joinPath(appRoot, tomlPath)
    const content = readRepositoryText(appRoot, fullPath)
    if (content === undefined) return []

    try {
      const raw = decodeToml(content) as Record<string, unknown>
      const type = raw.type as string
      const extDir = joinPath(appRoot, tomlPath, '..')
      const files = findSourceFiles(extDir, appRoot)
      return [{path: tomlPath, type, content, files}]
      // Invalid repository TOML is a coverage gap, not a scanner crash.
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      recordSkippedFile(appRoot, fullPath, {
        ok: false,
        reason: 'unreadable',
        detail: 'TOML could not be parsed',
      })
      return []
    }
  })
}

const MAX_REPOSITORY_FILE_SIZE_BYTES = 500_000

interface RepositoryReadSuccess {
  ok: true
  content: Buffer
}

interface RepositoryReadFailure {
  ok: false
  reason: 'too_large' | 'unreadable'
  sizeBytes?: number
  detail?: string
  errorCode?: string
}

type RepositoryReadResult = RepositoryReadSuccess | RepositoryReadFailure

/** A file that was discovered but not analyzed, and why. */
interface SkippedFile {
  path: string
  reason: RepositoryReadFailure['reason']
  size_bytes?: number
  detail?: string
}

/**
 * Files skipped during the most recent discovery pass.
 *
 * Module-level because discovery runs in several places and the scanner needs
 * to surface the total in scan metadata. Reset at the start of each scan via
 * `resetSkippedFiles()`.
 */
let skippedFiles: SkippedFile[] = []
const repositoryFileCache = new Map<string, RepositoryReadResult>()

export function resetSkippedFiles(): void {
  skippedFiles = []
  repositoryFileCache.clear()
}

export function getSkippedFiles(): SkippedFile[] {
  return [...skippedFiles]
}

function recordSkippedFile(appRoot: string, path: string, failure: RepositoryReadFailure): void {
  const repositoryPath = relativePath(appRoot, path).replace(/\\/g, '/')
  skippedFiles.push({
    path: repositoryPath.length > 0 ? repositoryPath : path,
    reason: failure.reason,
    ...(failure.sizeBytes === undefined ? {} : {size_bytes: failure.sizeBytes}),
    ...(failure.detail ? {detail: failure.detail} : {}),
  })
}

function readBoundedFile(path: string): RepositoryReadResult {
  try {
    const size = fileSizeSync(path)
    if (size > MAX_REPOSITORY_FILE_SIZE_BYTES) return {ok: false, reason: 'too_large', sizeBytes: size}
    return {ok: true, content: readFileSync(path)}
    // Discovery records unreadable files for trace coverage.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    const errorCode = (error as NodeJS.ErrnoException).code
    return {
      ok: false,
      reason: 'unreadable',
      detail: error instanceof Error ? error.message : String(error),
      ...(errorCode && /^[A-Z0-9_]+$/.test(errorCode) ? {errorCode} : {}),
    }
  }
}

function cachedRepositoryFile(appRoot: string, path: string, recordMissing: boolean): RepositoryReadResult {
  const absolutePath = resolvePath(path)
  const cached = repositoryFileCache.get(absolutePath)
  if (cached) return cached

  const result = readBoundedFile(absolutePath)
  repositoryFileCache.set(absolutePath, result)
  if (!result.ok && (recordMissing || result.errorCode !== 'ENOENT')) recordSkippedFile(appRoot, path, result)
  return result
}

function readRepositoryFile(appRoot: string, path: string): RepositoryReadResult {
  return cachedRepositoryFile(appRoot, path, true)
}

function readRepositoryText(appRoot: string, path: string): string | undefined {
  const result = readRepositoryFile(appRoot, path)
  return result.ok ? result.content.toString() : undefined
}

export function readOptionalRepositoryFile(appRoot: string, path: string): RepositoryReadResult {
  return cachedRepositoryFile(appRoot, path, false)
}

const SOURCE_LANGUAGES = {
  '.js': {name: 'javascript', supported: true},
  '.jsx': {name: 'javascript', supported: true},
  '.mjs': {name: 'javascript', supported: true},
  '.cjs': {name: 'javascript', supported: true},
  '.ts': {name: 'typescript', supported: true},
  '.tsx': {name: 'typescript', supported: true},
  '.mts': {name: 'typescript', supported: true},
  '.cts': {name: 'typescript', supported: true},
  '.prisma': {name: 'prisma', supported: true},
  '.liquid': {name: 'liquid', supported: true},
  '.html': {name: 'html', supported: true},
  '.rb': {name: 'ruby', supported: false},
  '.php': {name: 'php', supported: false},
  '.py': {name: 'python', supported: false},
  '.java': {name: 'java', supported: false},
  '.kt': {name: 'kotlin', supported: false},
  '.kts': {name: 'kotlin', supported: false},
  '.go': {name: 'go', supported: false},
  '.rs': {name: 'rust', supported: false},
  '.cs': {name: 'csharp', supported: false},
  '.swift': {name: 'swift', supported: false},
  '.scala': {name: 'scala', supported: false},
  '.ex': {name: 'elixir', supported: false},
  '.exs': {name: 'elixir', supported: false},
  '.vue': {name: 'vue', supported: false},
  '.svelte': {name: 'svelte', supported: false},
} as const

/** A path-only inventory; non-secret deterministic checks never open unsupported source. */
export function findSourceCandidates(dir: string, projectRoot = dir): SourceCandidate[] {
  const paths = globSync(
    Object.keys(SOURCE_LANGUAGES).map((extension) => `**/*${extension}`),
    {
      cwd: dir,
      ignore: discoveryIgnores(dir, projectRoot),
      absolute: false,
      dot: false,
      followSymbolicLinks: false,
      onlyFiles: false,
    },
  )

  return paths
    .map((path): SourceCandidate => {
      const extension = extname(path) as keyof typeof SOURCE_LANGUAGES
      const language = SOURCE_LANGUAGES[extension]
      return {
        path: relativePath(projectRoot, joinPath(dir, path)).replace(/\\/g, '/'),
        extension,
        language: language.name,
        supported: language.supported,
      }
    })
    .sort((left, right) => left.path.localeCompare(right.path))
}

/** Find and read only source languages supported by non-secret deterministic scanners. */
function findSourceFiles(dir: string, projectRoot = dir): SourceFile[] {
  const patterns = Object.entries(SOURCE_LANGUAGES)
    .filter(([, language]) => language.supported)
    .map(([extension]) => `**/*${extension}`)

  const files = globSync(patterns, {
    cwd: dir,
    ignore: discoveryIgnores(dir, projectRoot),
    absolute: false,
    dot: false,
    // Don't follow directory symlinks; a link to a large shared tree would inflate the scan.
    followSymbolicLinks: false,
    onlyFiles: false,
  })

  return files.map((file) => {
    const absolutePath = joinPath(dir, file)
    const projectPath = relativePath(projectRoot, absolutePath).replace(/\\/g, '/')
    const ext = extname(file)
    const result = readRepositoryFile(projectRoot, absolutePath)
    return {
      path: projectPath,
      absolutePath,
      ext,
      content: result.ok ? result.content.toString() : undefined,
    }
  })
}

/**
 * Find all source files in the app root (backend routes, etc.)
 */
export function findAppSourceFiles(appRoot: string): SourceFile[] {
  return findSourceFiles(appRoot)
}

const LOCKFILE_MANAGERS = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'])

const SECRET_TEXT_EXTENSIONS = [
  ...Object.keys(SOURCE_LANGUAGES),
  '.md',
  '.mdx',
  '.markdown',
  '.yaml',
  '.yml',
  '.json',
  '.jsonc',
  '.toml',
  '.sh',
  '.bash',
  '.zsh',
  '.fish',
  '.properties',
  '.ini',
  '.cfg',
  '.conf',
  '.xml',
  '.graphql',
  '.gql',
  '.sql',
  '.txt',
  '.pem',
]

function isProbablyBinary(content: Buffer): boolean {
  const sample = content.subarray(0, Math.min(content.length, 8_000))
  if (sample.includes(0)) return true
  let suspiciousControlBytes = 0
  for (const byte of sample) {
    if (byte < 8 || (byte > 13 && byte < 32)) suspiciousControlBytes++
  }
  return sample.length > 0 && suspiciousControlBytes / sample.length > 0.1
}

/** Text evidence inspected for secrets regardless of app framework support. */
export function findSensitiveFiles(appRoot: string): SourceFile[] {
  const patterns = [
    ...SECRET_TEXT_EXTENSIONS.map((extension) => `**/*${extension}`),
    '**/.env',
    '**/.env.*',
    '**/Dockerfile',
    '**/Dockerfile.*',
    '**/Containerfile',
    '**/Containerfile.*',
    '**/Gemfile',
    '**/Rakefile',
    '**/Procfile',
    '**/Makefile',
  ]
  const paths = [
    ...new Set(
      globSync(patterns, {
        cwd: appRoot,
        ignore: discoveryIgnores(appRoot, appRoot),
        absolute: false,
        dot: false,
        followSymbolicLinks: false,
        onlyFiles: false,
      }),
    ),
  ]
    .filter((path) => !LOCKFILE_MANAGERS.has(path))
    .sort()

  return paths.flatMap((path): SourceFile[] => {
    const absolutePath = joinPath(appRoot, path)
    const result = readRepositoryFile(appRoot, absolutePath)
    if (!result.ok) return [{path, absolutePath, ext: extname(path), content: undefined}]
    if (isProbablyBinary(result.content)) return []
    return [{path, absolutePath, ext: extname(path), content: result.content.toString()}]
  })
}

/** Find JavaScript package manifests. Dependency analysis intentionally supports JavaScript only. */
export function findManifestPaths(appRoot: string): string[] {
  const paths = globSync(['**/package.json'], {
    followSymbolicLinks: false,
    cwd: appRoot,
    ignore: discoveryIgnores(appRoot, appRoot),
    absolute: false,
    dot: false,
    onlyFiles: false,
  })
  return [...new Set(paths)].sort()
}

export function findManifests(appRoot: string, discoveredPaths = findManifestPaths(appRoot)): ManifestFile[] {
  const manifests: ManifestFile[] = []

  const pkgPaths = discoveredPaths.filter((path) => path.endsWith('package.json'))

  for (const pkgPath of pkgPaths) {
    const fullPath = joinPath(appRoot, pkgPath)
    const content = readRepositoryText(appRoot, fullPath)
    if (content === undefined) continue
    try {
      const pkg = JSON.parse(content)
      manifests.push({
        path: pkgPath,
        absolutePath: fullPath,
        type: 'npm',
        content,
        dependencies: pkg.dependencies ?? {},
        devDependencies: pkg.devDependencies ?? {},
        packageManager: typeof pkg.packageManager === 'string' ? pkg.packageManager : undefined,
      })
      // Invalid repository JSON is a coverage gap, not a scanner crash.
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      manifests.push({
        path: pkgPath,
        absolutePath: fullPath,
        type: 'npm',
        content,
        dependencies: {},
        devDependencies: {},
      })
      recordSkippedFile(appRoot, fullPath, {
        ok: false,
        reason: 'unreadable',
        detail: 'manifest could not be parsed',
      })
    }
  }

  return manifests
}
