import {Project} from './project.js'
import {AppHiddenConfig} from '../app/app.js'
import {getAppConfigurationShorthand} from '../app/loader.js'
import {dotEnvFileNames} from '../../constants.js'
import {patchAppHiddenConfigFile} from '../../services/app/patch-app-configuration-file.js'
import {getOrCreateAppConfigHiddenPath} from '../../utilities/app/config/hidden-app-config.js'
import {TomlFile} from '@shopify/cli-kit/node/toml/toml-file'
import {DotEnvFile} from '@shopify/cli-kit/node/dot-env'
import {relativePath} from '@shopify/cli-kit/node/path'

/**
 * Resolve the config-specific dotenv file for an active config.
 *
 * shopify.app.toml → .env
 * shopify.app.staging.toml → .env.staging (no fallback to .env)
 *
 * Non-default configs only load their config-specific dotenv file.
 * This prevents base .env values from leaking into non-default configs.
 * @public
 */
export function resolveDotEnv(project: Project, activeConfigPath: string): DotEnvFile | undefined {
  const shorthand = getAppConfigurationShorthand(activeConfigPath)
  if (shorthand) {
    const specificName = `${dotEnvFileNames.production}.${shorthand}`
    return project.dotenvFiles.get(specificName)
  }
  return project.dotenvFiles.get(dotEnvFileNames.production)
}

/**
 * Resolve the hidden config entry for a specific client_id.
 *
 * The raw .shopify/project.json is keyed by client_id.
 * This function looks up the entry for the given client_id,
 * handling the legacy format (flat top-level dev_store_url).
 * @public
 */
export async function resolveHiddenConfig(project: Project, clientId: string | undefined): Promise<AppHiddenConfig> {
  if (!clientId || typeof clientId !== 'string') return {}

  // Ensure the hidden config directory and file exist (matches old loadHiddenConfig behavior).
  // Other code paths (e.g., updateHiddenConfig, store-context) expect this file to be present.
  await getOrCreateAppConfigHiddenPath(project.directory)

  const raw = project.hiddenConfigRaw
  const entry = raw[clientId]

  if (entry && typeof entry === 'object') {
    return entry as AppHiddenConfig
  }

  // Legacy migration: top-level dev_store_url string
  if (typeof raw.dev_store_url === 'string') {
    // Migrate in place
    try {
      const hiddenConfigPath = await getOrCreateAppConfigHiddenPath(project.directory)
      await patchAppHiddenConfigFile(hiddenConfigPath, clientId, {dev_store_url: raw.dev_store_url})
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      // Migration failure is not fatal
    }
    return {dev_store_url: raw.dev_store_url}
  }

  return {}
}

/**
 * Filter extension config files to those belonging to the active config's
 * extension_directories. If the active config doesn't specify extension_directories,
 * uses the default (extensions/*).
 * @public
 */
export function extensionFilesForConfig(project: Project, activeConfig: TomlFile): TomlFile[] {
  const configDirs = activeConfig.content.extension_directories
  if (!Array.isArray(configDirs) || configDirs.length === 0) {
    // Default: extensions/* — filter project files by path prefix
    return project.extensionConfigFiles.filter((file) => {
      const relPath = relativePath(project.directory, file.path).replace(/\\/g, '/')
      return relPath.startsWith('extensions/')
    })
  }

  // Filter to files within the active config's declared directories.
  // Glob patterns are reduced to prefixes (e.g., "custom/*" → "custom/").
  // This is a simplification — complex globs like "foo/*/bar" will over-match.
  // In practice, only simple directory patterns are used in app configs.
  const dirPrefixes = (configDirs as string[]).map((dir) => {
    return dir.replace(/\*.*$/, '').replace(/\/?$/, '/')
  })

  return project.extensionConfigFiles.filter((file) => {
    const relPath = relativePath(project.directory, file.path).replace(/\\/g, '/')
    return dirPrefixes.some((prefix) => relPath.startsWith(prefix))
  })
}

/**
 * Filter web config files to those belonging to the active config's
 * web_directories. If not specified, returns all web files.
 * @public
 */
export function webFilesForConfig(project: Project, activeConfig: TomlFile): TomlFile[] {
  const configDirs = activeConfig.content.web_directories
  if (!Array.isArray(configDirs) || configDirs.length === 0) {
    return project.webConfigFiles
  }

  const dirPrefixes = (configDirs as string[]).map((dir) => dir.replace(/\*.*$/, '').replace(/\/?$/, '/'))

  return project.webConfigFiles.filter((file) => {
    const relPath = relativePath(project.directory, file.path).replace(/\\/g, '/')
    return dirPrefixes.some((prefix) => relPath.startsWith(prefix))
  })
}
