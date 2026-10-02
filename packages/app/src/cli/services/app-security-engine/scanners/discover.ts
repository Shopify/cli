import {inspectErrorReason, isMissingFilesystemEntry} from './filesystem-errors.js'
import {
  isDroppedEntry,
  isDroppedTrackedPath,
  isIgnoredByParentRepository,
  listGitIgnoredPaths,
  listNestedRepository,
  listTrackedFiles,
  repositoryIgnoredPaths,
} from './path-rules.js'
import {findRepositoryMarker} from './repository-marker.js'
import {DEPENDENCY_AUTOMATION_CONFIG_PATHS} from '../rules/dependency-automation-rules.js'
import {isValidFormatAppConfigurationFileName} from '../../../models/app/config-file-naming.js'
import {AppAccessScopesSchema, AppAuthSchema} from '../../../models/extensions/specifications/app_config_app_access.js'
import {WebhookSubscriptionSchema} from '../../../models/extensions/specifications/app_config_webhook_schemas/webhook_subscription_schema.js'
import {removeTrailingSlash} from '../../../models/extensions/specifications/validation/common.js'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {fileSizeSync, readFileSync} from '@shopify/cli-kit/node/fs'
import {
  cwd,
  basename,
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
import type {GatheredListingStatus, PathRules, RepositoryIgnoredPaths} from './path-rules.js'
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

/**
 * Load the selected shopify.app.toml file.
 */
export function loadAppToml(appConfigFilePath: string, appDirectory: string): AppTomlContent | null {
  const content = readRepositoryText(appConfigFilePath)
  if (content === undefined) return null
  try {
    const raw = decodeToml(content) as Record<string, unknown>
    return parseAppToml(raw, appConfigFilePath, content, appDirectory)
    // Invalid repository TOML is a coverage gap, not a scanner crash.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    recordSkippedFile(appConfigFilePath, {
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
  recordSkippedFile(path, {ok: false, reason: 'unreadable', detail})
}

function readDirectoryEntries(absolutePath: string, isScanDirectory: boolean): Dirent[] | undefined {
  try {
    return readdirSync(absolutePath, {withFileTypes: true})
    // An unreadable directory is a coverage gap, not a scanner crash.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    recordSkippedFile(absolutePath, {
      ok: false,
      reason: 'unreadable',
      detail: inspectErrorReason(isScanDirectory ? 'scan directory' : repositoryDisplayPath(absolutePath), error),
    })
    return undefined
  }
}

interface GatherInput {
  appDirectory: string
  /** Absolute real paths of the directories to walk. */
  scanDirectories: ReadonlyArray<string>
  /**
   * Every directory that was asked for, including those inside another scan directory, so each can be checked for the
   * ignored-scan-directory warning. It contains every entry of `scanDirectories`.
   */
  requestedScanDirectories: ReadonlyArray<string>
  /** Added after filtering, so no path rule can remove it. */
  selectedAppConfigFilePath?: string
  rules: PathRules
}

interface GatheredPaths {
  /** Sorted and unique, relative to the app directory, written with `/`. They may start with `../`. */
  paths: string[]
  /** Requested directories that their repository ignores, so only the files Git tracks in them are gathered. */
  ignoredScanDirectories: string[]
  /** How the first scan directory's ignored paths were found. Secret findings use it to explain why an ignored file was scanned. */
  listingStatus: GatheredListingStatus
}

interface GatheredScanDirectory {
  absolutePaths: string[]
  listingStatus: GatheredPaths['listingStatus']
}

export async function gatherPaths({
  appDirectory,
  scanDirectories,
  requestedScanDirectories,
  selectedAppConfigFilePath,
  rules,
}: GatherInput): Promise<GatheredPaths> {
  const ignoredScanDirectories: string[] = []
  if (rules.gitFiltering) {
    for (const requestedDirectory of requestedScanDirectories) {
      // eslint-disable-next-line no-await-in-loop
      if (await isIgnoredByParentRepository(requestedDirectory)) ignoredScanDirectories.push(requestedDirectory)
    }
  }

  const gathered: GatheredScanDirectory[] = []
  for (const scanDirectory of scanDirectories) {
    // eslint-disable-next-line no-await-in-loop
    gathered.push(await gatherScanDirectory(scanDirectory, rules, ignoredScanDirectories.includes(scanDirectory)))
  }

  const absolutePaths = [
    ...gathered.flatMap((scanDirectory) => scanDirectory.absolutePaths),
    ...(selectedAppConfigFilePath ? [selectedAppConfigFilePath] : []),
  ]
  return {
    paths: [...new Set(absolutePaths.map((path) => normalizeCliPath(relativePath(appDirectory, path))))].sort(),
    ignoredScanDirectories,
    listingStatus: gathered[0]?.listingStatus ?? (rules.gitFiltering ? 'tracked-only' : 'git-ignore-off'),
  }
}

async function gatherScanDirectory(
  scanDirectory: string,
  rules: PathRules,
  ignoredByRepository: boolean,
): Promise<GatheredScanDirectory> {
  if (!rules.gitFiltering) {
    return {
      absolutePaths: await walkDirectory(scanDirectory, rules, undefined),
      listingStatus: 'git-ignore-off',
    }
  }

  if (ignoredByRepository) {
    const trackedPaths = await listTrackedFiles(scanDirectory)
    // A normal walk would scan the untracked files that Git was told to ignore.
    if (trackedPaths === undefined) {
      throw new AbortError(`Couldn't list the files Git tracks in ${relativePath(cwd(), scanDirectory) || '.'}.`)
    }
    return {
      absolutePaths: trackedPaths
        .filter((trackedPath) => !isDroppedTrackedPath(rules, scanDirectory, trackedPath))
        .map((trackedPath) => joinPath(scanDirectory, trackedPath))
        .filter(isTrackedFile),
      listingStatus: 'tracked-only',
    }
  }

  const listing = await listGitIgnoredPaths(scanDirectory)
  return {
    absolutePaths: await walkDirectory(scanDirectory, rules, repositoryIgnoredPaths(scanDirectory, listing)),
    listingStatus: listing.status,
  }
}

/** Git lists a submodule as one entry, and a deleted tracked file is still listed. */
function isTrackedFile(absolutePath: string): boolean {
  try {
    return !lstatSync(absolutePath).isDirectory()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}

/**
 * Symlinks and special entries are listed but never traversed;
 * `readRepositoryFile` enforces containment on anything a finder reads.
 */
async function walkDirectory(
  scanDirectory: string,
  rules: PathRules,
  scanDirectoryRepository: RepositoryIgnoredPaths | undefined,
): Promise<string[]> {
  const files: string[] = []
  // Appended to while iterating.
  const pendingDirectories = [{directory: scanDirectory, repository: scanDirectoryRepository}]

  for (const {directory, repository} of pendingDirectories) {
    const entries = readDirectoryEntries(directory, directory === scanDirectory)
    if (entries === undefined) continue

    for (const entry of entries) {
      const absolutePath = joinPath(directory, entry.name)
      const isDirectory = entry.isDirectory()
      if (isDroppedEntry(rules, repository, {absolutePath, isDirectory})) continue
      if (!isDirectory) {
        files.push(absolutePath)
        continue
      }
      // eslint-disable-next-line no-await-in-loop
      const nestedRepository = rules.gitFiltering ? await listNestedRepository(absolutePath) : undefined
      pendingDirectories.push({
        directory: absolutePath,
        repository: nestedRepository ? repositoryIgnoredPaths(absolutePath, nestedRepository) : repository,
      })
    }
  }

  return files
}

/** A path inside nested extension directories belongs to each of them. */
function groupSourcePathsByExtensionDirectory(
  repositoryFiles: ReadonlyArray<string>,
  extensionDirectories: ReadonlySet<string>,
): Map<string, string[]> {
  const pathsByDirectory = new Map<string, string[]>(
    [...extensionDirectories].map((directory): [string, string[]] => [directory, []]),
  )

  for (const path of repositoryFiles) {
    if (!hasSupportedSourceExtension(path)) continue
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
 * Find extension-like repository content under the app root.
 *
 * `Project.load()` only considers paths in each app configuration's
 * `extension_directories`. App Security still scans every `shopify.extension.toml`
 * inside the repository boundary, including unconfigured extensions, because
 * those files can still contain secrets, XSS, and other security evidence.
 * Nested apps, generated output, and test trees remain excluded.
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
    const content = readRepositoryText(fullPath)
    if (content === undefined) return []

    try {
      const raw = decodeToml(content) as Record<string, unknown>
      const type = raw.type as string
      const files = findAppSourceFiles(appRoot, sourcePathsByDirectory.get(dirname(tomlPath)) ?? [])
      return [{path: tomlPath, type, content, files}]
      // Invalid repository TOML is a coverage gap, not a scanner crash.
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      recordSkippedFile(fullPath, {
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
 * to surface the total in scan metadata. Reset at the start of each scan by
 * `configureRepositoryReader()`.
 */
let skippedFiles: SkippedFile[] = []
const repositoryFileCache = new Map<string, RepositoryReadResult>()

interface RepositoryReaderConfiguration {
  appDirectory: string
  /** Absolute real paths. The containment boundary for a path is the scan directory that contains it. */
  scanDirectories: ReadonlyArray<string>
  /** Absolute paths that skip only the containment check; the size limit still applies. */
  explicitInputs: ReadonlySet<string>
}

let readerConfiguration: RepositoryReaderConfiguration | undefined

/** Configured once per scan. Also forgets the previous scan's skipped files and cached reads. */
export function configureRepositoryReader(configuration: RepositoryReaderConfiguration): void {
  readerConfiguration = configuration
  skippedFiles = []
  repositoryFileCache.clear()
}

function configuredReader(): RepositoryReaderConfiguration {
  if (!readerConfiguration) throw new BugError('The repository reader was used before it was configured.')
  return readerConfiguration
}

export function getSkippedFiles(): SkippedFile[] {
  return [...skippedFiles]
}

function recordSkippedFile(path: string, failure: RepositoryReadFailure): void {
  const repositoryPath = relativePath(configuredReader().appDirectory, path).replace(/\\/g, '/')
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
    // Discovery records unreadable files as scan coverage gaps.
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

function repositoryDisplayPath(path: string): string {
  const relative = normalizeCliPath(relativePath(configuredReader().appDirectory, path))
  if (relative.length === 0 || relative === '.' || isAbsolutePath(relative)) return 'path'
  return relative
}

/**
 * Resolve a repository path while preserving the difference between absence
 * and an unsafe or unreadable entry. Existing files take a single realpath;
 * prefix walking runs only after ENOENT/ENOTDIR so optional allowlist paths
 * can distinguish ordinary absence from a dangling or escaping intermediate.
 */
function inspectRepositoryPath(scanDirectory: string, path: string): InspectedPath {
  const absoluteRoot = resolvePath(scanDirectory)
  const absolutePath = resolvePath(absoluteRoot, path)
  const display = repositoryDisplayPath(absolutePath)
  if (!isSubpath(absoluteRoot, absolutePath)) {
    return {status: 'unresolved', reason: `${display} escapes the scan directory`}
  }

  let canonicalRoot: string
  try {
    canonicalRoot = realpathSync(absoluteRoot)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {status: 'unresolved', reason: inspectErrorReason('scan directory', error)}
  }

  const segments = normalizeCliPath(relativePath(absoluteRoot, absolutePath))
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.')
  if (segments.includes('..')) return {status: 'unresolved', reason: `${display} escapes the scan directory`}
  if (segments.length === 0) return {status: 'unresolved', reason: `${display} is not a file`}

  try {
    const canonicalPath = realpathSync(absolutePath)
    if (!isSubpath(canonicalRoot, canonicalPath)) {
      return {status: 'unresolved', reason: `${display} resolves outside the scan directory`}
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
        return {status: 'unresolved', reason: `${display} resolves outside the scan directory`}
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

function containedRepositoryPath(path: string): {path?: string; failure?: RepositoryReadFailure} {
  const scanDirectory = configuredReader().scanDirectories.find((directory) => isSubpath(directory, path))
  if (scanDirectory === undefined) {
    return {failure: repositoryPathFailure(`${repositoryDisplayPath(path)} is outside every scan directory`)}
  }
  const inspected = inspectRepositoryPath(scanDirectory, path)
  if (inspected.status === 'file') return {path: inspected.path}
  if (inspected.status === 'missing') return {failure: repositoryPathFailure('path does not exist')}
  return {failure: repositoryPathFailure(inspected.reason)}
}

/** An explicit input is followed wherever it points, because the user chose it rather than discovery. */
function explicitInputPath(path: string): {path?: string; failure?: RepositoryReadFailure} {
  const display = repositoryDisplayPath(path)
  try {
    const canonicalPath = realpathSync(path)
    if (!lstatSync(canonicalPath).isFile()) return {failure: repositoryPathFailure(`${display} is not a file`)}
    return {path: canonicalPath}
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {
      failure: repositoryPathFailure(
        isMissingFilesystemEntry(error) ? 'path does not exist' : inspectErrorReason(display, error),
      ),
    }
  }
}

function readRepositoryFile(absolutePath: string): RepositoryReadResult {
  const path = resolvePath(absolutePath)
  const cached = repositoryFileCache.get(path)
  if (cached) return cached

  const located = configuredReader().explicitInputs.has(path) ? explicitInputPath(path) : containedRepositoryPath(path)
  const result = located.path ? readBoundedFile(located.path) : located.failure!
  repositoryFileCache.set(path, result)
  if (!result.ok) recordSkippedFile(path, result)
  return result
}

function readRepositoryText(absolutePath: string): string | undefined {
  const result = readRepositoryFile(absolutePath)
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

/** Find and read only source languages supported by non-secret deterministic scanners. */
export function findAppSourceFiles(appRoot: string, repositoryFiles: ReadonlyArray<string>): SourceFile[] {
  return repositoryFiles.filter(hasSupportedSourceExtension).map((path) => {
    const absolutePath = joinPath(appRoot, path)
    const result = readRepositoryFile(absolutePath)
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

/** Text evidence inspected for secrets regardless of app framework support. */
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
    const result = readRepositoryFile(absolutePath)
    if (!result.ok) return [{path, absolutePath, ext: extname(path), content: undefined}]
    if (isProbablyBinary(result.content)) return []
    return [{path, absolutePath, ext: extname(path), content: result.content.toString()}]
  })
}

function nestedRepositoryReason(appRoot: string): string | undefined {
  const marker = findRepositoryMarker(appRoot)
  if (marker.status === 'none') return undefined
  if (marker.status === 'ambiguous') return marker.reason
  return marker.directory === appRoot ? undefined : 'App root is nested below a parent Git repository'
}

/**
 * Read local bot configuration only; hosted integrations and CI workflows are
 * outside this check's scope. Only gathered paths are read, through the reader,
 * so a gathered symbolic link that leaves its scan directory is reported as unresolved.
 */
export function findDependencyAutomationInputs(
  appRoot: string,
  gatheredPaths: ReadonlyArray<string>,
): DependencyAutomationInputs {
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

  const gathered = new Set(gatheredPaths)
  const files: SourceFile[] = []
  let unresolvedReason: string | undefined
  for (const relative of DEPENDENCY_AUTOMATION_CONFIG_PATHS) {
    if (!gathered.has(relative)) continue
    const absolutePath = joinPath(canonicalRoot, relative)
    const result = readRepositoryFile(absolutePath)
    if (!result.ok) {
      unresolvedReason ??=
        result.reason === 'too_large'
          ? `${relative} is too large to inspect`
          : (result.detail ?? `Could not read ${relative}`)
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

/** Find JavaScript package manifests. Dependency analysis intentionally supports JavaScript only. */
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
    const content = readRepositoryText(fullPath)
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
      recordSkippedFile(fullPath, {
        ok: false,
        reason: 'unreadable',
        detail: 'manifest could not be parsed',
      })
    }
  }

  return manifests
}
