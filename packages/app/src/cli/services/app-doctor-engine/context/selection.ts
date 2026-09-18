import {compareStrings} from './ordering.js'
import {AppDoctorContextError} from './types.js'
import {getAppConfigurationFileName} from '../../../models/app/config-file-naming.js'
import {configurationFileNames} from '../../../constants.js'
import type {
  AppDoctorApp,
  AppDoctorConfiguration,
  AppDoctorConfigurationDecision,
  AppDoctorConfigurationSelection,
  AppDoctorDiscovery,
  AppDoctorSelectionOptions,
} from './types.js'

/**
 * Pure selection rules. Nothing in this file touches the filesystem: callers
 * supply what discovery and inspection already observed.
 */

const formatList = (items: ReadonlyArray<string>) => items.map((item) => `  - ${item}`).join('\n')

/**
 * Pick the app to work on. A single discovered app needs no choice; several
 * apps need the caller to name one of their canonical directories.
 */
export function selectAppDoctorApp(discovery: AppDoctorDiscovery, choice?: string): AppDoctorApp {
  const {apps} = discovery
  if (apps.length === 0) {
    throw new AppDoctorContextError('APP_NOT_FOUND', 'No Shopify app configuration files were found.')
  }
  if (choice !== undefined) {
    const chosen = apps.find((app) => app.directory === choice)
    if (!chosen) {
      throw new AppDoctorContextError(
        'INVALID_APP_SELECTION',
        `${choice} is not one of the discovered apps:\n${formatList(apps.map((app) => app.directory))}`,
      )
    }
    return chosen
  }
  if (apps.length > 1) {
    throw new AppDoctorContextError(
      'APP_SELECTION_REQUIRED',
      `Several Shopify apps were found. Choose one of:\n${formatList(apps.map((app) => app.directory))}`,
    )
  }
  return apps[0]!
}

const selected = (
  configuration: AppDoctorConfiguration,
  source: AppDoctorConfigurationSelection['source'],
): AppDoctorConfigurationDecision => ({type: 'selected', selection: {configuration, source}})

const isBlank = (value: string) => value.trim().length === 0

const byFileName = (left: AppDoctorConfiguration, right: AppDoctorConfiguration) =>
  compareStrings(left.fileName, right.fileName)

const findByFileName = (configurations: ReadonlyArray<AppDoctorConfiguration>, fileName: string) =>
  configurations.find((configuration) => configuration.fileName === fileName)

/** Parsed files carrying exactly the supplied client ID, lexicographically first file name first. */
const findByClientId = (configurations: ReadonlyArray<AppDoctorConfiguration>, clientId: string) =>
  configurations
    .filter((configuration) => configuration.state === 'parsed' && configuration.clientId === clientId)
    .sort(byFileName)[0]

function validateSelectors(options: AppDoctorSelectionOptions): void {
  const {configName, clientId} = options
  if (configName !== undefined && clientId !== undefined) {
    throw new AppDoctorContextError('SELECTOR_CONFLICT', 'Provide either a config name or a client ID, not both.')
  }
  if (configName !== undefined && isBlank(configName)) {
    throw new AppDoctorContextError('INVALID_SELECTOR', 'The config name must not be blank.')
  }
  if (clientId !== undefined && isBlank(clientId)) {
    throw new AppDoctorContextError('INVALID_SELECTOR', 'The client ID must not be blank.')
  }
}

/**
 * An explicit file always wins. Other selectors may accompany it only when they
 * describe that very file; the engine never silently switches files.
 */
function selectExplicitConfiguration(
  configurations: ReadonlyArray<AppDoctorConfiguration>,
  explicitConfigurationPath: string,
  options: AppDoctorSelectionOptions,
): AppDoctorConfigurationDecision {
  const configuration = configurations.find((candidate) => candidate.path === explicitConfigurationPath)
  if (!configuration) {
    throw new AppDoctorContextError(
      'INVALID_CONFIGURATION_SELECTION',
      `${explicitConfigurationPath} is not a configuration file of the selected app.`,
    )
  }
  if (options.configName !== undefined && getAppConfigurationFileName(options.configName) !== configuration.fileName) {
    throw new AppDoctorContextError(
      'SELECTOR_CONFLICT',
      `The config name ${options.configName} does not refer to the explicitly selected file ${configuration.path}.`,
    )
  }
  if (options.clientId !== undefined && configuration.clientId !== options.clientId) {
    throw new AppDoctorContextError(
      'SELECTOR_CONFLICT',
      `The client ID ${options.clientId} does not match the explicitly selected file ${configuration.path}.`,
    )
  }
  return selected(configuration, 'file')
}

function selectByConfigName(
  configurations: ReadonlyArray<AppDoctorConfiguration>,
  configName: string,
): AppDoctorConfigurationDecision {
  const fileName = getAppConfigurationFileName(configName)
  const configuration = findByFileName(configurations, fileName)
  if (!configuration) {
    throw new AppDoctorContextError(
      'CONFIGURATION_NOT_FOUND',
      `Couldn't find ${fileName} among the app's configuration files:\n${formatList(
        configurations.map((candidate) => candidate.fileName),
      )}`,
    )
  }
  return selected(configuration, 'config')
}

function selectByClientId(
  configurations: ReadonlyArray<AppDoctorConfiguration>,
  clientId: string,
): AppDoctorConfigurationDecision {
  const configuration = findByClientId(configurations, clientId)
  if (!configuration) {
    throw new AppDoctorContextError(
      'CLIENT_ID_NOT_FOUND',
      `No parsed configuration file declares client_id ${clientId}.`,
    )
  }
  return selected(configuration, 'client-id')
}

function selectDefaultConfiguration(
  configurations: ReadonlyArray<AppDoctorConfiguration>,
): AppDoctorConfigurationDecision {
  const configuration = findByFileName(configurations, configurationFileNames.app)
  if (!configuration) {
    throw new AppDoctorContextError(
      'CONFIGURATION_NOT_FOUND',
      `Couldn't find ${configurationFileNames.app}. Pass --config to choose one of:\n${formatList(
        configurations.map((candidate) => candidate.fileName),
      )}`,
    )
  }
  return selected(configuration, 'default')
}

/**
 * The cached preference points at a file that no longer exists. Interactively,
 * a sole remaining file is taken without asking and several files need a
 * choice; non-interactively the stale preference is simply ignored. The cache
 * itself is never rewritten.
 */
function resolveStaleCache(
  configurations: ReadonlyArray<AppDoctorConfiguration>,
  interactive: boolean,
): AppDoctorConfigurationDecision {
  if (!interactive) return selectDefaultConfiguration(configurations)
  if (configurations.length === 1) return selected(configurations[0]!, 'stale-cache-replacement')
  if (configurations.length > 1) {
    return {type: 'selection-required', reason: 'stale-cache', configurations}
  }
  return selectDefaultConfiguration(configurations)
}

/**
 * Decide which configuration file to use, in priority order: explicit file,
 * config name, client ID, cached preference, then `shopify.app.toml`.
 */
export function selectAppDoctorConfiguration(
  configurations: ReadonlyArray<AppDoctorConfiguration>,
  options: AppDoctorSelectionOptions,
): AppDoctorConfigurationDecision {
  validateSelectors(options)
  const {explicitConfigurationPath, configName, clientId, cachedConfigName, interactive} = options

  if (explicitConfigurationPath !== undefined) {
    return selectExplicitConfiguration(configurations, explicitConfigurationPath, options)
  }
  if (configName !== undefined) return selectByConfigName(configurations, configName)
  if (clientId !== undefined) return selectByClientId(configurations, clientId)
  if (cachedConfigName !== undefined) {
    const cached = findByFileName(configurations, cachedConfigName)
    return cached ? selected(cached, 'cached') : resolveStaleCache(configurations, interactive)
  }
  return selectDefaultConfiguration(configurations)
}
