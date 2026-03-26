import {Project, type MalformedTomlFile} from './project.js'
import {AppHiddenConfig} from '../app/app.js'
import {getAppConfigurationShorthand} from '../app/loader.js'
import {dotEnvFileNames} from '../../constants.js'
import {patchAppHiddenConfigFile} from '../../services/app/patch-app-configuration-file.js'
import {getOrCreateAppConfigHiddenPath} from '../../utilities/app/config/hidden-app-config.js'
import {TomlFile} from '@shopify/cli-kit/node/toml/toml-file'
import {DotEnvFile} from '@shopify/cli-kit/node/dot-env'
import {matchGlob} from '@shopify/cli-kit/node/fs'
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
 *
 * Uses real glob matching (via minimatch) to preserve the same semantics as
 * Project.load()'s discovery globs, including patterns like "foo/&#42;/bar".
 * @public
 */
export function extensionFilesForConfig(project: Project, activeConfig: TomlFile): TomlFile[] {
  const globPatterns = extensionGlobPatternsForConfig(activeConfig)

  return project.extensionConfigFiles.filter((file) => {
    const relPath = relativePath(project.directory, file.path).replace(/\\/g, '/')
    return globPatterns.some((pattern) => matchGlob(relPath, pattern))
  })
}

export function malformedExtensionFilesForConfig(project: Project, activeConfig: TomlFile): MalformedTomlFile[] {
  const globPatterns = extensionGlobPatternsForConfig(activeConfig)

  return project.malformedExtensionConfigFiles.filter((file) => {
    const relPath = relativePath(project.directory, file.path).replace(/\\/g, '/')
    return globPatterns.some((pattern) => matchGlob(relPath, pattern))
  })
}

/**
 * Filter web config files to those belonging to the active config's
 * web_directories. If not specified, returns all web files.
 *
 * Uses real glob matching (via minimatch) to preserve the same semantics as
 * Project.load()'s discovery globs.
 * @public
 */
export function webFilesForConfig(project: Project, activeConfig: TomlFile): TomlFile[] {
  const globPatterns = webGlobPatternsForConfig(activeConfig)

  return project.webConfigFiles.filter((file) => {
    const relPath = relativePath(project.directory, file.path).replace(/\\/g, '/')
    return globPatterns.some((pattern) => matchGlob(relPath, pattern))
  })
}

export function malformedWebFilesForConfig(project: Project, activeConfig: TomlFile): MalformedTomlFile[] {
  const globPatterns = webGlobPatternsForConfig(activeConfig)

  return project.malformedWebConfigFiles.filter((file) => {
    const relPath = relativePath(project.directory, file.path).replace(/\\/g, '/')
    return globPatterns.some((pattern) => matchGlob(relPath, pattern))
  })
}

function extensionGlobPatternsForConfig(activeConfig: TomlFile): string[] {
  const configDirs = activeConfig.content.extension_directories
  const dirs = Array.isArray(configDirs) && configDirs.length > 0 ? (configDirs as string[]) : ['extensions/*']

  return dirs.map((dir) => `${dir}/*.extension.toml`)
}

function webGlobPatternsForConfig(activeConfig: TomlFile): string[] {
  const configDirs = activeConfig.content.web_directories
  if (!Array.isArray(configDirs) || configDirs.length === 0) {
    return ['**/shopify.web.toml']
  }

  return (configDirs as string[]).map((dir) => `${dir}/shopify.web.toml`)
}
