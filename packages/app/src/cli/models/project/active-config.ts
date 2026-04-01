import {Project} from './project.js'
import {resolveDotEnv, resolveHiddenConfig} from './config-selection.js'
import {AppHiddenConfig} from '../app/app.js'
import {getAppConfigurationFileName} from '../app/config-file-naming.js'
import {getCachedAppInfo} from '../../services/local-storage.js'
import use from '../../services/app/config/use.js'
import {TomlFile} from '@shopify/cli-kit/node/toml/toml-file'
import {DotEnvFile} from '@shopify/cli-kit/node/dot-env'
import {fileExistsSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError, type DomainError} from '@shopify/cli-kit/node/error'

export type ActiveConfigErrorCode = 'config-not-found'

export class ActiveConfigError
  extends AbortError
  implements DomainError<ActiveConfigErrorCode, {configName: string; directory: string}>
{
  constructor(
    public readonly code: ActiveConfigErrorCode,
    public readonly details: {configName: string; directory: string},
  ) {
    super(`ActiveConfigError: ${code}`)
  }
}

/** @public */
export type ConfigSource = 'flag' | 'cached' | 'default'

/**
 * The selected app configuration — one specific TOML from the project's
 * potentially many app config files, plus config-specific derived state.
 *
 * A sibling to Project, not a child. Project is the environment;
 * ActiveConfig is a selection decision applied to that environment.
 *
 * path and fileName are derivable from file.path — use the accessors
 * if you need them rather than storing redundant data.
 * @public
 */
export interface ActiveConfig {
  /** The selected app TOML file (from project.appConfigFiles) */
  file: TomlFile
  /** How the selection was made */
  source: ConfigSource
  /** Whether the config has a non-empty client_id */
  isLinked: boolean
  /** Config-specific dotenv (.env.staging or .env) */
  dotenv?: DotEnvFile
  /** Hidden config entry for this config's client_id */
  hiddenConfig: AppHiddenConfig
}

/**
 * Select the active app configuration from a project.
 *
 * Resolution priority:
 * 1. userProvidedConfigName (from --config flag)
 * 2. Cached selection (from `app config use`)
 * 3. Default (shopify.app.toml)
 *
 * If the cached config file no longer exists on disk, prompts the user
 * to select a new one via `app config use`.
 *
 * Derives config-specific state: dotenv and hidden config for the selected
 * config's client_id.
 * @public
 */
export async function selectActiveConfig(project: Project, userProvidedConfigName?: string): Promise<ActiveConfig> {
  let configName = userProvidedConfigName

  // Check cache for previously selected config
  const cachedConfigName = getCachedAppInfo(project.directory)?.configFile
  const cachedConfigPath = cachedConfigName ? joinPath(project.directory, cachedConfigName) : null

  // Handle stale cache: cached config file no longer exists
  if (!configName && cachedConfigPath && !fileExistsSync(cachedConfigPath)) {
    const warningContent = {
      headline: `Couldn't find ${cachedConfigName}`,
      body: [
        "If you have multiple config files, select a new one. If you only have one config file, it's been selected as your default.",
      ],
    }
    configName = await use({directory: project.directory, warningContent, shouldRenderSuccess: false})
  }

  configName = configName ?? cachedConfigName

  // Determine source after resolution so it reflects the actual selection path
  let source: ConfigSource
  if (userProvidedConfigName) {
    source = 'flag'
  } else if (configName) {
    source = 'cached'
  } else {
    source = 'default'
  }

  // Resolve the config file name and look it up in the project's pre-loaded files
  const configurationFileName = getAppConfigurationFileName(configName)
  const file = project.appConfigByName(configurationFileName)
  if (!file) {
    throw new ActiveConfigError('config-not-found', {configName: configurationFileName, directory: project.directory})
  }

  return buildActiveConfig(project, file, source)
}

async function buildActiveConfig(project: Project, file: TomlFile, source: ConfigSource): Promise<ActiveConfig> {
  const clientId = typeof file.content.client_id === 'string' ? file.content.client_id : undefined
  const isLinked = Boolean(clientId) && clientId !== ''
  const dotenv = resolveDotEnv(project, file.path)
  const hiddenConfig = await resolveHiddenConfig(project, clientId)

  return {
    file,
    source,
    isLinked,
    dotenv,
    hiddenConfig,
  }
}
