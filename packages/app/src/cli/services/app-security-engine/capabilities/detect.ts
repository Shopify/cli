import {dirname} from '@shopify/cli-kit/node/path'
import type {AppTomlContent, ExtensionInfo, ManifestFile, SourceFile} from '../scanners/types.js'
import type {Capabilities, DetectedLanguage, ProjectDetection, SourceCandidate} from '../types.js'

const REACT_ROUTER_PACKAGE = '@shopify/shopify-app-react-router'

/** Capabilities describe observed behavior. They do not imply framework support. */
export function detectCapabilities(
  appToml: AppTomlContent | null,
  extensions: ExtensionInfo[],
  sourceFiles: SourceFile[],
  appTomls: AppTomlContent[] = appToml ? [appToml] : [],
): Capabilities {
  const themeExtension = extensions.some((extension) => extension.type === 'theme')
  const appEmbed = extensions.some((extension) => extension.type === 'theme' && hasAppEmbedBlock(extension))
  const embeddedApp = appTomls.some((configuration) => configuration.raw.embedded === true)

  const scriptTags = sourceFiles.some((file) =>
    file.content ? /script[_-]?tags?|ScriptTag/i.test(file.content) : false,
  )
  const storefrontMetafieldWrites = sourceFiles.some((file) =>
    file.content
      ? /metafields?Set|metafields?\/.*(?:POST|PUT|create|update)|write.*metafield|metafield.*write/i.test(file.content)
      : false,
  )
  const hasBackend = sourceFiles.some(detectRouteDefinitions)

  return {
    theme_app_extension: themeExtension,
    app_embed: appEmbed,
    embedded_app: embeddedApp,
    script_tags: scriptTags,
    webhooks: Boolean(appToml?.webhooks.length),
    app_proxy: Boolean((appToml?.raw as Record<string, unknown>)?.app_proxy),
    storefront_metafield_writes: storefrontMetafieldWrites,
    has_backend: hasBackend,
    declared_ip_allowlist: false,
    checkout_extension: extensions.some(
      (extension) => extension.type === 'checkout_ui' || extension.type === 'checkout_ui_extension',
    ),
  }
}

/**
 * Find the React Router app roots, relative to the app directory, with `.` for the app directory itself.
 * A root needs a package.json that declares `@shopify/shopify-app-react-router` plus the conventional
 * app/routes + app/shopify.server structure, so code gathered from outside the app directory, such as an
 * --include-dir or web directory, is recognised. The app directory accepts the package from any gathered
 * manifest, such as a workspace root's.
 *
 * Roots inside another app's directory belong to that app. An app directory above this one holds this app
 * too, so only its own root is left out.
 */
export function detectReactRouterRoots(
  manifests: ManifestFile[],
  candidates: SourceCandidate[],
  otherAppDirectories: string[] = [],
): string[] {
  const declaringManifests = manifests.filter(
    (manifest) =>
      manifest.dependencies[REACT_ROUTER_PACKAGE] !== undefined ||
      manifest.devDependencies?.[REACT_ROUTER_PACKAGE] !== undefined,
  )
  if (declaringManifests.length === 0) return []
  const candidatePaths = candidates.map((candidate) => candidate.path)
  const roots = new Set(['.', ...declaringManifests.map((manifest) => dirname(manifest.path))])
  return [...roots]
    .filter((root) => hasReactRouterStructure(root, candidatePaths))
    .filter((root) => !belongsToOtherApp(root, otherAppDirectories))
    .sort()
}

/** Whether `path` is the app/shopify.server module of the React Router app at `root`. */
export function isReactRouterServerPath(root: string, path: string): boolean {
  const pathInRoot = pathWithinRoot(root, path)
  return pathInRoot !== undefined && /^app\/shopify\.server\.[cm]?[jt]sx?$/.test(pathInRoot)
}

/** `path` relative to `root`, or undefined when it is outside. Both use forward slashes, as gathering does. */
function pathWithinRoot(root: string, path: string): string | undefined {
  if (root === '.') return path
  return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : undefined
}

function hasReactRouterStructure(root: string, paths: string[]): boolean {
  return (
    paths.some((path) => pathWithinRoot(root, path)?.startsWith('app/routes/')) &&
    paths.some((path) => isReactRouterServerPath(root, path))
  )
}

function belongsToOtherApp(root: string, otherAppDirectories: string[]): boolean {
  return otherAppDirectories.some(
    (directory) =>
      root === directory || (!isAncestorOfAppDirectory(directory) && pathWithinRoot(directory, root) !== undefined),
  )
}

function isAncestorOfAppDirectory(directory: string): boolean {
  return directory.split('/').every((segment) => segment === '..')
}

/**
 * Detect the framework and product surface independently from capabilities.
 * React Router support requires at least one root from `detectReactRouterRoots`;
 * a coincidental route export is not enough to claim deterministic coverage.
 */
export function detectProject(
  extensions: ExtensionInfo[],
  candidates: SourceCandidate[],
  reactRouterRoots: string[],
): ProjectDetection {
  const reactRouter = reactRouterRoots.length > 0
  const themeExtensions = extensions.filter((extension) => extension.type === 'theme')
  const themeExtension = themeExtensions.length > 0
  const themePaths = new Set(themeExtensions.flatMap((extension) => extension.files.map((file) => file.path)))
  const hasSources = candidates.length > 0

  let surface: ProjectDetection['surface']
  if (reactRouter && themeExtension) surface = 'mixed'
  else if (reactRouter) surface = 'react_router'
  else if (themeExtension && candidates.some((candidate) => !themePaths.has(candidate.path))) surface = 'mixed'
  else if (themeExtension) surface = 'theme_app_extension'
  else if (hasSources) surface = 'unknown'
  else surface = 'config_only'

  let framework: ProjectDetection['framework']
  if (reactRouter) framework = 'react_router'
  else if (surface === 'config_only' || surface === 'theme_app_extension') framework = 'none'
  else if (surface === 'mixed') framework = 'mixed'
  else framework = 'unknown'

  const filesByLanguage = new Map<string, {supported: boolean; files: string[]}>()
  for (const candidate of candidates) {
    const current = filesByLanguage.get(candidate.language) ?? {supported: candidate.supported, files: []}
    current.supported &&= candidate.supported
    current.files.push(candidate.path)
    filesByLanguage.set(candidate.language, current)
  }
  const languages: DetectedLanguage[] = [...filesByLanguage.entries()]
    .map(([name, value]) => ({
      name,
      support: value.supported ? ('supported' as const) : ('unsupported' as const),
      files: value.files.sort(),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

  return {framework, surface, languages}
}

function hasAppEmbedBlock(extension: ExtensionInfo): boolean {
  return extension.files.some(
    (file) => file.ext === '.liquid' && file.content?.includes('"target"') && file.content?.includes('body'),
  )
}

function detectRouteDefinitions(file: SourceFile): boolean {
  const content = file.content
  if (!content) return false
  if (/\b(?:app|router)\.(get|post|put|delete|patch)\s*\(/.test(content)) return true
  if (/export\s+(?:async\s+)?(?:function|const)\s+(?:loader|action)\b/.test(content)) return true
  return false
}
