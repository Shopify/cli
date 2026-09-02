import type {AppTomlContent, ExtensionInfo, ManifestFile, SourceFile} from '../scanners/types.js'
import type {Capabilities, DetectedLanguage, ProjectDetection, SourceCandidate} from '../types.js'

/** Capabilities describe observed behavior. They do not imply framework support. */
export function detectCapabilities(
  appToml: AppTomlContent | null,
  extensions: ExtensionInfo[],
  sourceFiles: SourceFile[],
): Capabilities {
  const themeExtension = extensions.some((extension) => extension.type === 'theme')
  const appEmbed = extensions.some((extension) => extension.type === 'theme' && hasAppEmbedBlock(extension))

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
 * Detect the framework and product surface independently from capabilities.
 * React Router support requires both its manifest package and the conventional
 * app/routes + app/shopify.server structure; a coincidental route export is
 * not enough to claim deterministic coverage.
 */
export function detectProject(
  manifests: ManifestFile[],
  extensions: ExtensionInfo[],
  candidates: SourceCandidate[],
): ProjectDetection {
  const dependencyNames = new Set(
    manifests.flatMap((manifest) => [
      ...Object.keys(manifest.dependencies),
      ...Object.keys(manifest.devDependencies ?? {}),
    ]),
  )
  const candidatePaths = new Set(candidates.map((candidate) => candidate.path))
  const hasReactRouterPackage = dependencyNames.has('@shopify/shopify-app-react-router')
  const hasReactRouterStructure =
    [...candidatePaths].some((path) => path.startsWith('app/routes/')) &&
    [...candidatePaths].some((path) => /^app\/shopify\.server\.[cm]?[jt]sx?$/.test(path))
  const reactRouter = hasReactRouterPackage && hasReactRouterStructure
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
