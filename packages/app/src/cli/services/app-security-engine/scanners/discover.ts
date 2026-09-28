import {inspectErrorReason, isMissingFilesystemEntry} from './filesystem-errors.js'
import {createFilePathMatcher, createPathMatcher} from './path-rules.js'
import {findRepositoryMarker} from './repository-marker.js'
import {DEPENDENCY_AUTOMATION_CONFIG_PATHS} from '../rules/dependency-automation-rules.js'
import {APP_CONFIG_FILE_GLOB, isValidFormatAppConfigurationFileName} from '../../../models/app/config-file-naming.js'
import {AppAccessScopesSchema, AppAuthSchema} from '../../../models/extensions/specifications/app_config_app_access.js'
import {WebhookSubscriptionSchema} from '../../../models/extensions/specifications/app_config_webhook_schemas/webhook_subscription_schema.js'
import {removeTrailingSlash} from '../../../models/extensions/specifications/validation/common.js'
import {fileExistsSync, fileSizeSync, globSync, readFileSync} from '@shopify/cli-kit/node/fs'
import {
  basename,
  cwd,
  dirname,
  extname,
  isAbsolutePath,
  isSubpath,
  joinPath,
  normalizePath as normalizeCliPath,
  relativePath,
  resolvePath,
} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'
import {decodeToml} from '@shopify/cli-kit/node/toml/codec'
import {lstatSync, readdirSync, realpathSync} from 'node:fs'
import type {PathRules} from './path-rules.js'
import type {SourceCandidate} from '../types.js'
import type {
  AppTomlContent,
  DependencyAutomationInputs,
  ExtensionInfo,
  SourceFile,
  ManifestFile,
  WebhookSubscription,
} from './types.js'
import type {Dirent} from 'node:fs'

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
 * App identity matches the rest of Shopify CLI: walk up for
 * `shopify.app.toml` / `shopify.app.<name>.toml` using
 * `isValidFormatAppConfigurationFileName`. This is not `Project.load()` — that
 * loader also reads package, environment, and hidden configuration, follows
 * different symlink policy, and does not keep the bounded raw bytes App Security
 * hashes and reports as coverage.
 */
export function findAppRoot(startPath?: string): string {
  const requestedPath = resolvePath(startPath ?? cwd())
  if (startPath && !fileExistsSync(requestedPath)) {
    throw new AppRootDiscoveryError(`App path does not exist: ${startPath}`)
  }

  let directory = requestedPath
  if (startPath && lstatSync(requestedPath).isFile()) {
    if (!isValidFormatAppConfigurationFileName(basename(requestedPath))) {
      throw new AppRootDiscoveryError(`App path is not a directory or Shopify app configuration file: ${startPath}`)
    }
    return dirname(requestedPath)
  }
  if (!lstatSync(directory).isDirectory()) {
    throw new AppRootDiscoveryError(`App path is not a directory: ${startPath ?? directory}`)
  }

  while (true) {
    if (listAppConfigFiles(directory).length > 0) return directory

    const parent = dirname(directory)
    if (parent === directory) break
    directory = parent
  }

  throw new AppRootDiscoveryError(`Could not find a shopify.app*.toml from: ${startPath ?? cwd()}`)
}

function listAppConfigFiles(directory: string): string[] {
  return globSync(APP_CONFIG_FILE_GLOB, {
    cwd: directory,
    deep: 1,
    dot: false,
    onlyFiles: false,
    followSymbolicLinks: false,
  }).filter((file) => isValidFormatAppConfigurationFileName(basename(file)))
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

/** CLI webhook section shape. URI fields stay strings so INSECURE_WEBHOOK_URL can report http. */
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

const SecurityWebhookSubscriptionSchema = WebhookSubscriptionSchema.extend({
  uri: zod.preprocess(
    (arg) => removeTrailingSlash(arg as string),
    zod.string({invalid_type_error: 'Value must be string'}),
  ),
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
  const legacyScopes = parsed.data.scopes?.split(/[\s,]+/).filter(Boolean) ?? []
  const scopes = [...new Set([...legacyScopes, ...(parsed.data.required_scopes ?? [])])]
  return scopes.length > 0 ? scopes.join(',') : undefined
}

function projectRedirectUrls(value: unknown, path: string, appRoot?: string): string[] {
  if (value === undefined) return []
  const parsed = AppAuthSchema.safeParse(value)
  if (!parsed.success) {
    recordSectionGap(appRoot, path, 'auth section could not be parsed')
    return []
  }
  return parsed.data.redirect_urls
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

  const webhookSubscriptions = (parsed.data.subscriptions ?? []).flatMap((subscription) =>
    projectWebhookSubscription(subscription, path, appRoot),
  )
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

const WebhookUriOnlySchema = zod.object({
  uri: zod.preprocess(
    (arg) => removeTrailingSlash(arg as string),
    zod.string({invalid_type_error: 'Value must be string'}),
  ),
})

function projectWebhookSubscription(value: unknown, path: string, appRoot?: string): WebhookSubscription[] {
  const parsed = SecurityWebhookSubscriptionSchema.safeParse(value)
  if (parsed.success) {
    return [
      {
        topics: [...(parsed.data.topics ?? []), ...(parsed.data.compliance_topics ?? [])],
        uri: parsed.data.uri,
      },
    ]
  }

  recordSectionGap(appRoot, path, 'webhook subscription could not be parsed')
  const uriOnly = WebhookUriOnlySchema.safeParse(value)
  if (!uriOnly.success) return []
  return [{topics: [], uri: uriOnly.data.uri}]
}

function recordSectionGap(appRoot: string | undefined, path: string, detail: string): void {
  if (!appRoot) return
  recordSkippedFile(appRoot, path, {ok: false, reason: 'unreadable', detail})
}

/**
 * A directory holding its own `shopify.app*.toml` is an independent Shopify app.
 * Nested apps are independent scan roots and never evidence for their parent
 * app, so the walker stops at them: a structural boundary, much as git treats
 * a nested repository as opaque to the enclosing one. (Nested git repositories
 * themselves are NOT a boundary here; only their `.git` entry is pruned.)
 *
 * Detection looks at the directory's raw entries, not the rule-filtered ones:
 * a nested app whose configuration file happens to be gitignored is still a
 * nested app.
 */
function isNestedAppDirectory(entries: ReadonlyArray<Dirent>): boolean {
  return entries.some((entry) => !entry.isDirectory() && isValidFormatAppConfigurationFileName(entry.name))
}

function readDirectoryEntries(appRoot: string, absolutePath: string, displayPath: string): Dirent[] | undefined {
  try {
    return readdirSync(absolutePath, {withFileTypes: true})
    // An unreadable directory is a coverage gap, not a scanner crash.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    recordSkippedFile(appRoot, absolutePath, {
      ok: false,
      reason: 'unreadable',
      detail: inspectErrorReason(displayPath, error),
    })
    return undefined
  }
}

/**
 * List every repository file the scan may inspect, as sorted app-root-relative
 * POSIX paths.
 *
 * The walk applies `rules` with .gitignore semantics and prunes excluded
 * directories: it never descends into them, so the matcher is only ever asked
 * about paths whose ancestors are known to be included (its precondition).
 *
 * Directory entries use lstat semantics, so a symlink is never a directory
 * here. Symlinks (to files or directories), FIFOs and other special entries
 * are listed but never traversed; `readRepositoryFile` later enforces
 * containment and realpath rules on anything a finder decides to read, and
 * records failures. Dot-folders and dotfiles are walked unless a rule excludes
 * them (see `DEFAULT_EXCLUDE_PATTERNS`).
 */
export function listRepositoryFiles(appRoot: string, rules: PathRules): string[] {
  const matcher = createPathMatcher(rules)
  const files: string[] = []
  // Relative directory paths still to be read; '' is the app root itself. Subdirectories are appended
  // while iterating, which `for...of` supports: the array iterator re-checks the length on every step.
  const pendingDirectories = ['']

  for (const relativeDirectory of pendingDirectories) {
    const absoluteDirectory = relativeDirectory === '' ? appRoot : joinPath(appRoot, relativeDirectory)
    const entries = readDirectoryEntries(
      appRoot,
      absoluteDirectory,
      relativeDirectory === '' ? 'app root' : relativeDirectory,
    )
    if (entries === undefined) continue
    // A nested app is a scan root in its own right; nothing beneath it belongs to this scan.
    if (relativeDirectory !== '' && isNestedAppDirectory(entries)) continue

    for (const entry of entries) {
      const relative = relativeDirectory === '' ? entry.name : `${relativeDirectory}/${entry.name}`
      if (entry.isDirectory()) {
        // Never descend into an excluded directory: pruning here is what keeps the matcher's
        // precondition (every ancestor of a queried path is included) true.
        if (!matcher(relative, {directory: true})) pendingDirectories.push(relative)
      } else if (!matcher(relative, {directory: false})) {
        files.push(relative)
      }
    }
  }

  return files.sort()
}

/**
 * Group source paths by the extension directories that contain them, walking
 * each path's ancestors once instead of filtering the whole repository per
 * extension. `extensionDirectories` are app-root-relative; `.` is the app root
 * and contains every path. A path inside nested extension directories belongs
 * to each of them. Paths keep their input order within every group.
 */
function groupSourcePathsByExtensionDirectory(
  repositoryFiles: ReadonlyArray<string>,
  extensionDirectories: ReadonlySet<string>,
): Map<string, string[]> {
  const pathsByDirectory = new Map<string, string[]>(
    [...extensionDirectories].map((directory): [string, string[]] => [directory, []]),
  )

  for (const path of repositoryFiles) {
    if (!hasSupportedSourceExtension(path)) continue
    // `dirname` yields `.` for a top-level file and for `.` itself, which ends the climb.
    let ancestor = dirname(path)
    while (ancestor !== '.') {
      pathsByDirectory.get(ancestor)?.push(path)
      ancestor = dirname(ancestor)
    }
    pathsByDirectory.get('.')?.push(path)
  }

  return pathsByDirectory
}

/**
 * Find extension-like repository content among the walked repository files.
 *
 * `Project.load()` only considers paths in each app configuration's
 * `extension_directories`. App Security still scans every `shopify.extension.toml`
 * inside the repository boundary, including unconfigured extensions, because
 * those files can still contain secrets, XSS, and other security evidence.
 * Nested apps, generated output, and test trees are already absent from
 * `repositoryFiles` (see `listRepositoryFiles`).
 */
export function findExtensions(appRoot: string, repositoryFiles: ReadonlyArray<string>): ExtensionInfo[] {
  const extensionTomls = repositoryFiles.filter((path) => basename(path) === 'shopify.extension.toml')
  if (extensionTomls.length === 0) return []

  const sourcePathsByDirectory = groupSourcePathsByExtensionDirectory(
    repositoryFiles,
    new Set(extensionTomls.map((tomlPath) => dirname(tomlPath))),
  )

  return extensionTomls.flatMap((tomlPath) => {
    const fullPath = joinPath(appRoot, tomlPath)
    const content = readRepositoryText(appRoot, fullPath)
    if (content === undefined) return []

    try {
      const raw = decodeToml(content) as Record<string, unknown>
      const type = raw.type as string
      const files = findAppSourceFiles(appRoot, sourcePathsByDirectory.get(dirname(tomlPath)) ?? [])
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
    return {
      ok: false,
      reason: 'unreadable',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

function repositoryPathFailure(detail: string): RepositoryReadFailure {
  return {ok: false, reason: 'unreadable', detail}
}

type InspectedPath = {status: 'missing'} | {status: 'file'; path: string} | {status: 'unresolved'; reason: string}

function repositoryDisplayPath(appRoot: string, path: string): string {
  const relative = normalizeCliPath(relativePath(appRoot, path))
  if (
    relative.length === 0 ||
    relative === '.' ||
    relative === '..' ||
    relative.startsWith('../') ||
    isAbsolutePath(relative)
  ) {
    return 'path'
  }
  return relative
}

/**
 * Resolve a repository path while preserving the difference between absence
 * and an unsafe or unreadable entry. Existing files take a single realpath;
 * prefix walking runs only after ENOENT/ENOTDIR so optional allowlist paths
 * can distinguish ordinary absence from a dangling or escaping intermediate.
 */
function inspectRepositoryPath(appRoot: string, path: string): InspectedPath {
  const absoluteRoot = resolvePath(appRoot)
  const absolutePath = resolvePath(absoluteRoot, path)
  const display = repositoryDisplayPath(absoluteRoot, absolutePath)
  if (!isSubpath(absoluteRoot, absolutePath)) {
    return {status: 'unresolved', reason: `${display} escapes the app root`}
  }

  let canonicalRoot: string
  try {
    canonicalRoot = realpathSync(absoluteRoot)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {status: 'unresolved', reason: inspectErrorReason('app root', error)}
  }

  const segments = normalizeCliPath(relativePath(absoluteRoot, absolutePath))
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.')
  if (segments.includes('..')) return {status: 'unresolved', reason: `${display} escapes the app root`}
  if (segments.length === 0) return {status: 'unresolved', reason: `${display} is not a file`}

  try {
    const canonicalPath = realpathSync(absolutePath)
    if (!isSubpath(canonicalRoot, canonicalPath)) {
      return {status: 'unresolved', reason: `${display} resolves outside the app root`}
    }
    if (!lstatSync(canonicalPath).isFile()) {
      return {status: 'unresolved', reason: `${display} is not a file`}
    }
    return {status: 'file', path: canonicalPath}
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    if (isMissingFilesystemEntry(error)) {
      return inspectMissingRepositoryPath(canonicalRoot, segments, display)
    }
    return {status: 'unresolved', reason: inspectErrorReason(display, error)}
  }
}

function inspectMissingRepositoryPath(canonicalRoot: string, segments: string[], display: string): InspectedPath {
  let currentPath = canonicalRoot
  for (const [index, segment] of segments.entries()) {
    currentPath = joinPath(currentPath, segment)
    try {
      lstatSync(currentPath)
      const canonicalPath = realpathSync(currentPath)
      if (!isSubpath(canonicalRoot, canonicalPath)) {
        return {status: 'unresolved', reason: `${display} resolves outside the app root`}
      }

      const stats = lstatSync(canonicalPath)
      const isLastSegment = index === segments.length - 1
      if (isLastSegment) {
        if (!stats.isFile()) return {status: 'unresolved', reason: `${display} is not a file`}
      } else if (!stats.isDirectory()) {
        return {status: 'unresolved', reason: `${display} contains an entry that is not a directory`}
      }
      currentPath = canonicalPath
      // Discovery must distinguish a missing optional allowlist entry from an
      // entry that exists but cannot be inspected safely.
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      if (isMissingFilesystemEntry(error)) {
        // lstat succeeds for a dangling link, so ENOENT from realpath is an
        // unsafe existing entry rather than ordinary allowlist absence.
        try {
          if (lstatSync(currentPath).isSymbolicLink()) {
            return {status: 'unresolved', reason: `${display} contains a dangling symbolic link`}
          }
          // eslint-disable-next-line no-catch-all/no-catch-all
        } catch {
          return {status: 'missing'}
        }
        return {status: 'missing'}
      }
      return {status: 'unresolved', reason: inspectErrorReason(display, error)}
    }
  }

  return {status: 'file', path: currentPath}
}

function containedRepositoryPath(appRoot: string, path: string): {path?: string; failure?: RepositoryReadFailure} {
  const inspected = inspectRepositoryPath(appRoot, path)
  if (inspected.status === 'file') return {path: inspected.path}
  if (inspected.status === 'missing') return {failure: repositoryPathFailure('path does not exist')}
  return {failure: repositoryPathFailure(inspected.reason)}
}

function readRepositoryFile(appRoot: string, path: string): RepositoryReadResult {
  const absoluteRoot = resolvePath(appRoot)
  const absolutePath = resolvePath(path)
  const cacheKey = `${absoluteRoot}\0${absolutePath}`
  const cached = repositoryFileCache.get(cacheKey)
  if (cached) return cached

  const containedPath = containedRepositoryPath(absoluteRoot, absolutePath)
  const result = containedPath.path ? readBoundedFile(containedPath.path) : containedPath.failure!
  repositoryFileCache.set(cacheKey, result)
  if (!result.ok) recordSkippedFile(appRoot, path, result)
  return result
}

function readRepositoryText(appRoot: string, path: string): string | undefined {
  const result = readRepositoryFile(appRoot, path)
  return result.ok ? result.content.toString() : undefined
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
  '.ejs': {name: 'ejs', supported: false},
  '.erb': {name: 'erb', supported: false},
  '.hbs': {name: 'handlebars', supported: false},
  '.jinja2': {name: 'jinja2', supported: false},
  '.twig': {name: 'twig', supported: false},
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

type SourceExtension = keyof typeof SOURCE_LANGUAGES

/** Extension matching is exact and case-sensitive: `.JS` is not treated as source. */
function sourceLanguageFor(path: string): (typeof SOURCE_LANGUAGES)[SourceExtension] | undefined {
  const extension = extname(path)
  return extension in SOURCE_LANGUAGES ? SOURCE_LANGUAGES[extension as SourceExtension] : undefined
}

function hasSupportedSourceExtension(path: string): boolean {
  return sourceLanguageFor(path)?.supported === true
}

/** A path-only inventory; non-secret deterministic checks never open unsupported source. */
export function findSourceCandidates(repositoryFiles: ReadonlyArray<string>): SourceCandidate[] {
  return repositoryFiles
    .flatMap((path): SourceCandidate[] => {
      const language = sourceLanguageFor(path)
      if (!language) return []
      return [{path, extension: extname(path), language: language.name, supported: language.supported}]
    })
    .sort((left, right) => left.path.localeCompare(right.path))
}

/**
 * Read the source files (backend routes, extension code, etc.) whose language
 * is supported by the non-secret deterministic scanners. Results keep the order
 * of `repositoryFiles`, which callers pass in `listRepositoryFiles` order.
 */
export function findAppSourceFiles(appRoot: string, repositoryFiles: ReadonlyArray<string>): SourceFile[] {
  // `findExtensions` passes pre-filtered groups, but the filter is this function's own contract for every caller.
  return repositoryFiles.filter(hasSupportedSourceExtension).map((path) => {
    const absolutePath = joinPath(appRoot, path)
    const result = readRepositoryFile(appRoot, absolutePath)
    return {
      path,
      absolutePath,
      ext: extname(path),
      content: result.ok ? result.content.toString() : undefined,
    }
  })
}

const LOCKFILE_MANAGERS = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'])

const SECRET_TEXT_EXTENSIONS = new Set([
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
])

/** Extensionless files that routinely carry credentials. */
const SENSITIVE_FILE_NAMES = new Set(['Dockerfile', 'Containerfile', 'Gemfile', 'Rakefile', 'Procfile', 'Makefile'])

function isSensitiveFile(path: string): boolean {
  if (SECRET_TEXT_EXTENSIONS.has(extname(path))) return true
  const fileName = basename(path)
  return (
    fileName === '.env' ||
    fileName.startsWith('.env.') ||
    SENSITIVE_FILE_NAMES.has(fileName) ||
    fileName.startsWith('Dockerfile.') ||
    fileName.startsWith('Containerfile.')
  )
}

function isProbablyBinary(content: Buffer): boolean {
  const sample = content.subarray(0, Math.min(content.length, 8_000))
  if (sample.includes(0)) return true
  let suspiciousControlBytes = 0
  for (const byte of sample) {
    if (byte < 8 || (byte > 13 && byte < 32)) suspiciousControlBytes++
  }
  return sample.length > 0 && suspiciousControlBytes / sample.length > 0.1
}

/**
 * Text evidence inspected for secrets regardless of app framework support.
 * Results keep the order of `repositoryFiles`, which callers pass in
 * `listRepositoryFiles` order.
 */
export function findSensitiveFiles(
  appRoot: string,
  repositoryFiles: ReadonlyArray<string>,
  selectedAppConfigFileName?: string,
): SourceFile[] {
  const paths = repositoryFiles
    .filter(isSensitiveFile)
    // Compares the whole relative path, so only the app root's own lockfiles are dropped.
    .filter((path) => !LOCKFILE_MANAGERS.has(path))
    .filter((path) => {
      const fileName = basename(path)
      if (!isValidFormatAppConfigurationFileName(fileName)) return true
      return fileName === selectedAppConfigFileName
    })

  return paths.flatMap((path): SourceFile[] => {
    const absolutePath = joinPath(appRoot, path)
    const result = readRepositoryFile(appRoot, absolutePath)
    if (!result.ok) return [{path, absolutePath, ext: extname(path), content: undefined}]
    if (isProbablyBinary(result.content)) return []
    return [{path, absolutePath, ext: extname(path), content: result.content.toString()}]
  })
}

/**
 * Why repository-level configuration cannot be attributed to the app, if it
 * cannot. The app owns its configuration when its own `.git` marker is the
 * nearest one (or there is no repository at all); a marker found only above
 * the app root means the configuration belongs to an enclosing repository.
 */
function nestedRepositoryReason(appRoot: string): string | undefined {
  const marker = findRepositoryMarker(appRoot)
  if (marker.status === 'none') return undefined
  if (marker.status === 'ambiguous') return marker.reason
  return marker.directory === appRoot ? undefined : 'App root is nested below a parent Git repository'
}

function recordRejectedAllowlistPath(appRoot: string, relative: string, failure: RepositoryReadFailure): void {
  recordSkippedFile(appRoot, resolvePath(appRoot, relative), failure)
}

/**
 * Read local bot configuration only; hosted integrations and CI workflows are
 * outside this check's scope.
 *
 * The allowlisted paths are read directly from disk rather than taken from the
 * walked file list, so that a symlinked `.github` (which the walker never
 * enters) is reported as unresolved rather than missing. The scan's `rules`
 * still apply: hosted bots read the repository, so a configuration file git
 * ignores configures nothing and is treated exactly like a missing one.
 */
export function findDependencyAutomationInputs(appRoot: string, rules: PathRules): DependencyAutomationInputs {
  let canonicalRoot: string
  try {
    canonicalRoot = realpathSync(resolvePath(appRoot))
    if (!lstatSync(canonicalRoot).isDirectory()) {
      return {files: [], unresolvedReason: 'App root is not a directory'}
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {files: [], unresolvedReason: inspectErrorReason('app root', error)}
  }

  const repositoryReason = nestedRepositoryReason(canonicalRoot)
  if (repositoryReason) return {files: [], unresolvedReason: repositoryReason}

  const isExcluded = createFilePathMatcher(rules)
  const files: SourceFile[] = []
  let unresolvedReason: string | undefined
  for (const relative of DEPENDENCY_AUTOMATION_CONFIG_PATHS) {
    if (isExcluded(relative)) continue
    const inspected = inspectRepositoryPath(canonicalRoot, relative)
    if (inspected.status === 'missing') continue
    if (inspected.status === 'unresolved') {
      recordRejectedAllowlistPath(canonicalRoot, relative, {
        ok: false,
        reason: 'unreadable',
        detail: inspected.reason,
      })
      unresolvedReason ??= inspected.reason
      continue
    }

    const absolutePath = resolvePath(canonicalRoot, relative)
    const result = readBoundedFile(inspected.path)
    if (!result.ok) {
      recordRejectedAllowlistPath(canonicalRoot, relative, result)
      unresolvedReason ??=
        result.reason === 'too_large' ? `${relative} is too large to inspect` : `Could not read ${relative}`
      continue
    }

    files.push({
      path: relative,
      absolutePath,
      ext: extname(relative),
      content: result.content.toString(),
    })
    // One safely inspected configuration file is enough for this presence-only check.
    break
  }
  return files.length > 0 ? {files} : {files, ...(unresolvedReason ? {unresolvedReason} : {})}
}

/**
 * Find JavaScript package manifests. Dependency analysis intentionally supports JavaScript only.
 * Results keep the order of `repositoryFiles`, which callers pass in `listRepositoryFiles` order.
 */
export function findManifestPaths(repositoryFiles: ReadonlyArray<string>): string[] {
  return repositoryFiles.filter((path) => basename(path) === 'package.json')
}

const PackageManifestSchema = zod.object({
  dependencies: zod.record(zod.string()).optional(),
  devDependencies: zod.record(zod.string()).optional(),
})

export function findManifests(appRoot: string, discoveredPaths: ReadonlyArray<string>): ManifestFile[] {
  const manifests: ManifestFile[] = []

  const pkgPaths = discoveredPaths.filter((path) => basename(path) === 'package.json')

  for (const pkgPath of pkgPaths) {
    const fullPath = joinPath(appRoot, pkgPath)
    const content = readRepositoryText(appRoot, fullPath)
    if (content === undefined) continue
    try {
      const pkg = PackageManifestSchema.parse(JSON.parse(content))
      manifests.push({
        path: pkgPath,
        absolutePath: fullPath,
        type: 'npm',
        content,
        dependencies: pkg.dependencies ?? {},
        devDependencies: pkg.devDependencies ?? {},
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
