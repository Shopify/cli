import fg from 'fast-glob'
import {parse as parseToml} from '@iarna/toml'
import {fileExistsSync, fileSizeSync, readFileSync} from '@shopify/cli-kit/node/fs'
import {cwd, dirname, extname, joinPath, relativePath} from '@shopify/cli-kit/node/path'
import type {AppTomlContent, ExtensionInfo, SourceFile, ManifestFile, WebhookSubscription} from '../rules/types.js'

/**
 * Find the app root by walking up from CWD looking for shopify.app.toml.
 * If a specific path is passed (--app), use that directly.
 */
export function findAppRoot(startPath?: string): string {
  if (startPath && fileExistsSync(startPath)) {
    // If they passed a TOML file, use its directory.
    if (startPath.endsWith('.toml')) return dirname(startPath)
    return startPath
  }

  let dir = cwd()
  for (let index = 0; index < 20; index++) {
    // Check for shopify.app.toml or shopify.app.*.toml.
    const tomls = fg.sync('shopify.app*.toml', {cwd: dir, deep: 1, onlyFiles: true})
    if (tomls.length > 0) {
      return dir
    }
    const parent = joinPath(dir, '..')
    if (parent === dir) break
    dir = parent
  }

  // Fallback: use CWD even without TOML (file scan mode)
  return cwd()
}

/**
 * Find and parse all shopify.app.*.toml files in the app root.
 */
export function findAppTomls(appRoot: string): AppTomlContent[] {
  const files = fg.sync('shopify.app*.toml', {cwd: appRoot, deep: 1, onlyFiles: true})

  return files.map((file) => {
    const path = joinPath(appRoot, file)
    const raw = parseToml(readFileSync(path).toString()) as Record<string, unknown>
    return parseAppToml(raw, path)
  })
}

/**
 * Load a specific shopify.app.toml file.
 */
export function loadAppToml(tomlPath: string): AppTomlContent | null {
  if (!fileExistsSync(tomlPath)) return null
  const raw = parseToml(readFileSync(tomlPath).toString()) as Record<string, unknown>
  return parseAppToml(raw, tomlPath)
}

export function parseAppToml(raw: Record<string, unknown>, path: string): AppTomlContent {
  const scopes = (raw.access_scopes as Record<string, unknown>)?.scopes as string | undefined
  const auth = raw.auth as Record<string, unknown> | undefined
  const redirectUrls = auth?.redirect_urls as string[] | undefined
  const webhooksSection = raw.webhooks as Record<string, unknown> | undefined
  const webhookSubs = (webhooksSection?.subscriptions as Record<string, unknown>[])?.map(
    (sub): WebhookSubscription => ({
      // Merge regular topics and compliance_topics into one array.
      // Shopify allows either `topics = [...]` or `compliance_topics = [...]`
      // for GDPR webhooks — both should count toward the mandatory check.
      topics: [...((sub.topics as string[]) ?? []), ...((sub.compliance_topics as string[]) ?? [])],
      uri: sub.uri as string,
    }),
  )

  // Check for IP allowlist in various possible locations
  const ipAllowlistRaw =
    (raw.ip_allowlist as Record<string, unknown>) ??
    ((raw.access as Record<string, unknown>)?.ip_allowlist as Record<string, unknown>) ??
    ((raw.security as Record<string, unknown>)?.ip_allowlist as Record<string, unknown>) ??
    undefined

  // Handle both formats: [ip_allowlist] with addresses=[...] or ip_allowlist = ["..."]
  let ipAllowlist: string[] | undefined
  if (Array.isArray(ipAllowlistRaw)) {
    ipAllowlist = ipAllowlistRaw as string[]
  } else if (ipAllowlistRaw && Array.isArray(ipAllowlistRaw.addresses)) {
    ipAllowlist = ipAllowlistRaw.addresses as string[]
  }

  return {
    raw,
    path,
    scopes,
    redirect_urls: redirectUrls,
    webhooks: webhookSubs,
    ip_allowlist: ipAllowlist,
  }
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
export const IGNORED_DIRECTORIES = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  '**/fixtures/**',
  '**/*-fixtures/**',
  '**/__fixtures__/**',
]

/**
 * Find all theme app extensions and their files.
 */
export function findExtensions(appRoot: string): ExtensionInfo[] {
  const extensionTomls = fg.sync('**/shopify.extension.toml', {
    followSymbolicLinks: false,
    cwd: appRoot,
    ignore: IGNORED_DIRECTORIES,
    absolute: false,
  })

  // Filter out extensions that belong to sub-apps (have a shopify.app.toml in an ancestor)
  const subAppTomls = new Set(
    fg
      .sync('**/shopify.app*.toml', {
        followSymbolicLinks: false,
        cwd: appRoot,
        ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
        absolute: false,
      })
      .filter((path) => path !== 'shopify.app.toml' && !path.match(/^shopify\.app\.[^.]+\.toml$/))
      .map((path) => path.replace(/shopify\.app[^/]*\.toml$/, '')),
  )

  const filtered = extensionTomls.filter((tomlPath) => {
    // Skip if this extension is inside a sub-app directory
    for (const subAppDir of subAppTomls) {
      if (subAppDir && tomlPath.startsWith(`${subAppDir}/`)) return false
    }
    return true
  })

  return filtered.map((tomlPath) => {
    const fullPath = joinPath(appRoot, tomlPath)
    const raw = parseToml(readFileSync(fullPath).toString()) as Record<string, unknown>
    const type = raw.type as string

    const extDir = joinPath(appRoot, tomlPath, '..')
    const files = findSourceFiles(extDir, appRoot)

    return {
      path: tomlPath,
      type,
      files,
    }
  })
}

/**
 * Maximum file size we will read into memory for analysis.
 *
 * Files above this are recorded as skipped rather than silently dropped — see
 * `getSkippedFiles`. Minified bundles routinely exceed it and are exactly
 * where committed secrets hide, so "we did not look" must be visible in the
 * trace instead of being indistinguishable from "we looked and found nothing".
 */
export const MAX_FILE_SIZE_BYTES = 500_000

/** A file that was discovered but not analyzed, and why. */
export interface SkippedFile {
  path: string
  reason: 'too_large' | 'unreadable'
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

export function resetSkippedFiles(): void {
  skippedFiles = []
}

export function getSkippedFiles(): SkippedFile[] {
  return [...skippedFiles]
}

/**
 * Find all source files in a directory (JS, TS, JSX, TSX, Liquid, PHP, Ruby, Python).
 */
export function findSourceFiles(dir: string, projectRoot = dir): SourceFile[] {
  const extensions = ['.js', '.ts', '.jsx', '.tsx', '.liquid', '.php', '.rb', '.py']
  const patterns = extensions.map((ext) => `**/*${ext}`)

  const files = fg.sync(patterns, {
    cwd: dir,
    ignore: [...IGNORED_DIRECTORIES, '*.test.*', '*.spec.*'],
    absolute: false,
    // Do not traverse symlinks. Third-party app code is untrusted input; a
    // symlink to / or to a large shared directory would take the scan outside
    // the app root and inflate the run.
    followSymbolicLinks: false,
  })

  return files.map((file) => {
    const absolutePath = joinPath(dir, file)
    const projectPath = relativePath(projectRoot, absolutePath).replace(/\\/g, '/')
    const ext = extname(file)
    let content: string | undefined
    try {
      const size = fileSizeSync(absolutePath)
      if (size < MAX_FILE_SIZE_BYTES) {
        content = readFileSync(absolutePath).toString()
      } else {
        // Record rather than silently drop: an unscanned file isn't a clean file.
        skippedFiles.push({
          path: projectPath,
          reason: 'too_large',
          size_bytes: size,
        })
      }
      // Discovery records unreadable files for trace coverage.
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      skippedFiles.push({
        path: projectPath,
        reason: 'unreadable',
        detail: error instanceof Error ? error.message : String(error),
      })
    }
    return {
      path: projectPath,
      absolutePath,
      ext,
      content,
    }
  })
}

/**
 * Find all source files in the app root (backend routes, etc.)
 */
export function findAppSourceFiles(appRoot: string): SourceFile[] {
  return findSourceFiles(appRoot)
}

/**
 * Find package manifests (package.json, Gemfile, composer.json)
 */
export function findManifestPaths(appRoot: string): string[] {
  const paths = fg.sync('**/package.json', {
    followSymbolicLinks: false,
    cwd: appRoot,
    ignore: IGNORED_DIRECTORIES,
    absolute: false,
  })
  for (const rootManifest of ['Gemfile', 'composer.json']) {
    if (fileExistsSync(joinPath(appRoot, rootManifest))) paths.push(rootManifest)
  }
  return [...new Set(paths)].sort()
}

export function findManifests(appRoot: string, discoveredPaths = findManifestPaths(appRoot)): ManifestFile[] {
  const manifests: ManifestFile[] = []

  const pkgPaths = discoveredPaths.filter((path) => path.endsWith('package.json'))

  for (const pkgPath of pkgPaths) {
    try {
      const fullPath = joinPath(appRoot, pkgPath)
      const pkg = JSON.parse(readFileSync(fullPath).toString())
      manifests.push({
        path: pkgPath,
        absolutePath: fullPath,
        type: 'npm',
        dependencies: pkg.dependencies ?? {},
        devDependencies: pkg.devDependencies ?? {},
      })
      // Invalid manifests are recorded as unreadable for trace coverage.
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      skippedFiles.push({
        path: pkgPath,
        reason: 'unreadable',
        detail: `manifest could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  // Gemfile
  const gemfilePath = joinPath(appRoot, 'Gemfile')
  if (discoveredPaths.includes('Gemfile')) {
    try {
      const content = readFileSync(gemfilePath).toString()
      const dependencies: Record<string, string> = {}
      for (const line of content.split('\n')) {
        const match = line.match(/gem\s+['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]+)['"])?/)
        const dependencyName = match?.[1]
        if (dependencyName !== undefined) dependencies[dependencyName] = match?.[2] ?? 'latest'
      }
      manifests.push({
        path: 'Gemfile',
        absolutePath: gemfilePath,
        type: 'ruby',
        dependencies,
      })
      // Invalid manifests are recorded as unreadable for trace coverage.
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      skippedFiles.push({
        path: 'Gemfile',
        reason: 'unreadable',
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // composer.json
  const composerPath = joinPath(appRoot, 'composer.json')
  if (discoveredPaths.includes('composer.json')) {
    try {
      const composer = JSON.parse(readFileSync(composerPath).toString())
      manifests.push({
        path: 'composer.json',
        absolutePath: composerPath,
        type: 'php',
        dependencies: composer.require ?? {},
        devDependencies: composer['require-dev'] ?? {},
      })
      // Invalid manifests are recorded as unreadable for trace coverage.
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      skippedFiles.push({
        path: 'composer.json',
        reason: 'unreadable',
        detail: `manifest could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  return manifests
}
