import type {Capabilities} from '../types.js'
import type {SourceFile, AppTomlContent, ExtensionInfo} from '../rules/types.js'

/**
 * Detect what the app does by examining config and source files.
 * This determines which rules run and which are skipped.
 */
export function detectCapabilities(
  appToml: AppTomlContent | null,
  extensions: ExtensionInfo[],
  sourceFiles: SourceFile[],
): Capabilities {
  // Shopify CLI uses type = "theme" for theme app extensions (not "theme_app_extension").
  // See https://shopify.dev/docs/api/cli/app#extension-types
  const themeExtension = extensions.some((extension) => extension.type === 'theme')
  const appEmbed = extensions.some((extension) => extension.type === 'theme' && hasAppEmbedBlock(extension))

  const scriptTags = sourceFiles.some((file) => {
    if (!file.content) return false
    // Match scriptTag, script_tag, ScriptTag in any language
    return /script[_-]?tags?|ScriptTag/i.test(file.content)
  })

  const webhooks = Boolean(appToml?.webhooks?.length)

  const appProxy = Boolean((appToml?.raw as Record<string, unknown>)?.app_proxy)

  const storefrontMetafieldWrites = sourceFiles.some((file) => {
    if (!file.content) return false
    // Match metafield write patterns
    return /metafields?Set|metafields?\/.*(?:POST|PUT|create|update)|write.*metafield|metafield.*write/i.test(
      file.content,
    )
  })

  const hasBackend = sourceFiles.some((file) => {
    if (!file.content) return false
    return detectRouteDefinitions(file)
  })

  const declaredIpAllowlist = Boolean(appToml?.ip_allowlist?.length)

  // Shopify CLI uses type = "checkout_ui" for checkout UI extensions.
  const checkoutExtension = extensions.some(
    (extension) => extension.type === 'checkout_ui' || extension.type === 'checkout_ui_extension',
  )

  return {
    theme_app_extension: themeExtension,
    app_embed: appEmbed,
    script_tags: scriptTags,
    webhooks,
    app_proxy: appProxy,
    storefront_metafield_writes: storefrontMetafieldWrites,
    has_backend: hasBackend,
    declared_ip_allowlist: declaredIpAllowlist,
    checkout_extension: checkoutExtension,
  }
}

function hasAppEmbedBlock(extension: ExtensionInfo): boolean {
  return extension.files.some(
    (file) => file.ext === '.liquid' && file.content?.includes('"target"') && file.content?.includes('body'),
  )
}

/**
 * Detect route definitions across frameworks.
 * Express: app.get/post/put/delete, router.get/post
 * Rails: get/post/match in routes.rb
 * Remix: export const loader/action
 * PHP: Route::get/post
 */
function detectRouteDefinitions(file: SourceFile): boolean {
  const content = file.content
  if (!content) return false

  // Express / Remix
  if (/\b(?:app|router)\.(get|post|put|delete|patch)\s*\(/.test(content)) return true
  if (/export\s+(?:async\s+)?(?:function|const)\s+(?:loader|action)\b/.test(content)) return true

  // Rails
  if (file.ext === '.rb' && /\b(?:get|post|put|delete|match)\s+['"]/.test(content)) return true

  // PHP Laravel
  if (file.ext === '.php' && /Route::(?:get|post|put|delete)\s*\(/.test(content)) return true

  // Flask
  if (file.ext === '.py' && /@(?:app|bp)\.route\s*\(/.test(content)) return true

  return false
}
