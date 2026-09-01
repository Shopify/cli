import {canonicalAppRoot, safeReadRepositoryFile} from '../repository-io.js'
import fg from 'fast-glob'
import {parse as parseToml} from '@iarna/toml'
import {fileExistsSync} from '@shopify/cli-kit/node/fs'
import {cwd, dirname, extname, joinPath, relativePath, resolvePath} from '@shopify/cli-kit/node/path'
import {lstatSync} from 'node:fs'
import type {SafeReadFailure, SafeReadResult} from '../repository-io.js'
import type {SourceCandidate} from '../types.js'
import type {AppTomlContent, ExtensionInfo, SourceFile, ManifestFile, WebhookSubscription} from '../rules/types.js'

/** Find the nearest app root without ever substituting CWD for a bad explicit path. */
export function findAppRoot(startPath?: string): string {
  const requestedPath = resolvePath(startPath ?? cwd())
  if (startPath && !fileExistsSync(requestedPath)) throw new Error(`App path does not exist: ${startPath}`)

  let directory = requestedPath
  if (startPath && lstatSync(requestedPath).isFile()) {
    if (!requestedPath.endsWith('.toml')) throw new Error(`App path is not a directory or TOML file: ${startPath}`)
    return dirname(requestedPath)
  }
  if (!lstatSync(directory).isDirectory()) throw new Error(`App path is not a directory: ${startPath ?? directory}`)

  while (true) {
    const tomls = fg.sync('shopify.app*.toml', {
      cwd: directory,
      deep: 1,
      onlyFiles: false,
      followSymbolicLinks: false,
    })
    if (tomls.length > 0) return directory

    const parent = dirname(directory)
    if (parent === directory) break
    directory = parent
  }

  throw new Error(`Could not find a shopify.app*.toml from: ${startPath ?? cwd()}`)
}

/**
 * Find and parse all shopify.app.*.toml files in the app root.
 */
export function findAppTomls(appRoot: string): AppTomlContent[] {
  const files = fg.sync('shopify.app*.toml', {
    cwd: appRoot,
    deep: 1,
    onlyFiles: false,
    followSymbolicLinks: false,
  })

  return files.flatMap((file) => {
    const path = joinPath(appRoot, file)
    const content = readRepositoryText(appRoot, path)
    if (content === undefined) return []
    try {
      const raw = parseToml(content) as Record<string, unknown>
      return [parseAppToml(raw, path, content)]
      // Invalid repository TOML is a coverage gap, not a scanner crash.
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      recordSkippedFile(appRoot, path, {
        ok: false,
        path,
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
    const raw = parseToml(content) as Record<string, unknown>
    return parseAppToml(raw, tomlPath, content)
    // Invalid repository TOML is a coverage gap, not a scanner crash.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    recordSkippedFile(appRoot, tomlPath, {
      ok: false,
      path: tomlPath,
      reason: 'unreadable',
      detail: 'TOML could not be parsed',
    })
    return null
  }
}

export function parseAppToml(raw: Record<string, unknown>, path: string, content?: string): AppTomlContent {
  const accessScopes = asRecord(raw.access_scopes)
  const auth = asRecord(raw.auth)
  const webhooksSection = asRecord(raw.webhooks)
  const legacyScopes =
    optionalString(accessScopes?.scopes)
      ?.split(/[\s,]+/)
      .filter(Boolean) ?? []
  const scopes = [...new Set([...legacyScopes, ...stringArray(accessScopes?.required_scopes)])]
  const webhookSubscriptions = Array.isArray(webhooksSection?.subscriptions)
    ? webhooksSection.subscriptions.flatMap((value): WebhookSubscription[] => {
        const subscription = asRecord(value)
        if (!subscription || typeof subscription.uri !== 'string') return []
        return [
          {
            topics: [...stringArray(subscription.topics), ...stringArray(subscription.compliance_topics)],
            uri: subscription.uri,
          },
        ]
      })
    : []
  const privacyCompliance = asRecord(webhooksSection?.privacy_compliance)
  const privacyComplianceWebhooks = [
    {topic: 'customers/redact', uri: optionalString(privacyCompliance?.customer_deletion_url)},
    {topic: 'customers/data_request', uri: optionalString(privacyCompliance?.customer_data_request_url)},
    {topic: 'shop/redact', uri: optionalString(privacyCompliance?.shop_deletion_url)},
  ].flatMap(({topic, uri}): WebhookSubscription[] => (uri ? [{topics: [topic], uri}] : []))

  return {
    raw,
    path,
    content,
    scopes: scopes.length > 0 ? scopes.join(',') : undefined,
    apiVersion: optionalString(webhooksSection?.api_version),
    redirectUrls: stringArray(auth?.redirect_urls),
    webhooks: [...webhookSubscriptions, ...privacyComplianceWebhooks],
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
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
  '**/app-doctor-review.json',
  '**/app-doctor-trace.json',
  '**/app-doctor-findings.json',
  '**/.app-doctor-review.json.*.tmp',
  '**/.app-doctor-trace.json.*.tmp',
  '**/.app-doctor-findings.json.*.tmp',
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
      fg
        .sync('**/shopify.app*.toml', {
          followSymbolicLinks: false,
          cwd: appRoot,
          ignore: IGNORED_DIRECTORIES,
          absolute: false,
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

/** Find all theme app extensions and their files. */
export function findExtensions(appRoot: string): ExtensionInfo[] {
  const extensionTomls = fg.sync('**/shopify.extension.toml', {
    followSymbolicLinks: false,
    cwd: appRoot,
    ignore: discoveryIgnores(appRoot, appRoot),
    absolute: false,
    onlyFiles: false,
  })

  return extensionTomls.flatMap((tomlPath) => {
    const fullPath = joinPath(appRoot, tomlPath)
    const content = readRepositoryText(appRoot, fullPath)
    if (content === undefined) return []

    try {
      const raw = parseToml(content) as Record<string, unknown>
      const type = raw.type as string
      const extDir = joinPath(appRoot, tomlPath, '..')
      const files = findSourceFiles(extDir, appRoot)
      return [{path: tomlPath, type, content, files}]
      // Invalid repository TOML is a coverage gap, not a scanner crash.
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      recordSkippedFile(appRoot, fullPath, {
        ok: false,
        path: fullPath,
        reason: 'unreadable',
        detail: 'TOML could not be parsed',
      })
      return []
    }
  })
}

/** A file that was discovered but not analyzed, and why. */
interface SkippedFile {
  path: string
  reason: SafeReadFailure['reason']
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
const repositoryFileCache = new Map<string, SafeReadResult>()

export function resetSkippedFiles(): void {
  skippedFiles = []
  repositoryFileCache.clear()
}

export function getSkippedFiles(): SkippedFile[] {
  return [...skippedFiles]
}

function recordSkippedFile(appRoot: string, path: string, failure: SafeReadFailure): void {
  const repositoryPath = relativePath(appRoot, path).replace(/\\/g, '/')
  skippedFiles.push({
    path: repositoryPath.length > 0 ? repositoryPath : path,
    reason: failure.reason,
    ...(failure.sizeBytes === undefined ? {} : {size_bytes: failure.sizeBytes}),
    ...(failure.detail ? {detail: failure.detail} : {}),
  })
}

function canonicalRepositoryPath(appRoot: string, path: string): {root: string; path: string} {
  const root = canonicalAppRoot(appRoot)
  const pathFromRoot = relativePath(appRoot, path)
  return {root, path: joinPath(root, pathFromRoot)}
}

function cachedRepositoryFile(appRoot: string, path: string, recordMissing: boolean): SafeReadResult {
  const canonical = canonicalRepositoryPath(appRoot, path)
  const cached = repositoryFileCache.get(canonical.path)
  if (cached) return cached

  const result = safeReadRepositoryFile(canonical.root, canonical.path)
  repositoryFileCache.set(canonical.path, result)
  if (!result.ok && (recordMissing || result.errorCode !== 'ENOENT')) recordSkippedFile(appRoot, path, result)
  return result
}

function readRepositoryFile(appRoot: string, path: string): SafeReadResult {
  return cachedRepositoryFile(appRoot, path, true)
}

function readRepositoryText(appRoot: string, path: string): string | undefined {
  const result = readRepositoryFile(appRoot, path)
  return result.ok ? result.content.toString() : undefined
}

export function readOptionalRepositoryFile(appRoot: string, path: string): SafeReadResult {
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
  const paths = fg.sync(
    Object.keys(SOURCE_LANGUAGES).map((extension) => `**/*${extension}`),
    {
      cwd: dir,
      ignore: discoveryIgnores(dir, projectRoot),
      absolute: false,
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

  const files = fg.sync(patterns, {
    cwd: dir,
    ignore: discoveryIgnores(dir, projectRoot),
    absolute: false,
    // Do not traverse symlinks. Third-party app code is untrusted input; a
    // symlink to / or to a large shared directory would take the scan outside
    // the app root and inflate the run.
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
      fg.sync(patterns, {
        cwd: appRoot,
        ignore: discoveryIgnores(appRoot, appRoot),
        absolute: false,
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
  const paths = fg.sync(['**/package.json'], {
    followSymbolicLinks: false,
    cwd: appRoot,
    ignore: discoveryIgnores(appRoot, appRoot),
    absolute: false,
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
        path: fullPath,
        reason: 'unreadable',
        detail: 'manifest could not be parsed',
      })
    }
  }

  return manifests
}
