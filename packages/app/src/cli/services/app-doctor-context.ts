import {
  AppDoctorContextError,
  createAppDoctorContext,
  discoverAppDoctorApps,
  inspectAppDoctorConfigurations,
  selectAppDoctorApp,
  selectAppDoctorConfiguration,
} from './app-doctor-engine/index.js'
import {AppLocalStorageSchema, getCachedAppInfo} from './local-storage.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import type {
  AppDoctorApp,
  AppDoctorConfiguration,
  AppDoctorConfigurationSelection,
  AppDoctorContext,
  AppDoctorContextErrorCode,
  AppDoctorDiscovery,
} from './app-doctor-engine/index.js'

/**
 * CLI adapter around the App Doctor context engine.
 *
 * This is the only place that prompts or reads the app cache. The engine
 * decides; this file asks the user when allowed and otherwise turns engine
 * outcomes into actionable `AbortError`s. The cache is read, never written:
 * a stale preference is resolved for this invocation only.
 */

export interface ResolveAppDoctorContextOptions {
  readonly directory?: string
  readonly configName?: string
  readonly clientId?: string
  /** Decided by the caller (typically `isTerminalInteractive()`); prompts are only shown when true. */
  readonly interactive: boolean
  /** Injected for tests; defaults to the shared app cache. */
  readonly appStorage?: LocalStorage<AppLocalStorageSchema>
}

const formatList = (items: ReadonlyArray<string>) => items.map((item) => `  - ${item}`).join('\n')

/** Next-step hints for engine failures the user can act on with a flag. */
const TRY_MESSAGES: Partial<Record<AppDoctorContextErrorCode, string>> = {
  APP_NOT_FOUND: 'Run this command inside a Shopify app, or pass --path to point at one.',
  CONFIGURATION_NOT_FOUND: 'Pass --config to pick a configuration file explicitly.',
  CLIENT_ID_NOT_FOUND: 'Pass --config to pick a configuration file explicitly.',
}

async function chooseApp(discovery: AppDoctorDiscovery, interactive: boolean): Promise<AppDoctorApp> {
  if (discovery.apps.length <= 1) return selectAppDoctorApp(discovery)
  const directories = discovery.apps.map((app) => app.directory)
  if (!interactive) {
    throw new AbortError(
      `Several Shopify apps were found:\n${formatList(directories)}`,
      'Pass --path with one of these directories to choose an app.',
    )
  }
  const chosen = await renderSelectPrompt({
    message: 'Which app do you want to review?',
    choices: directories.map((directory) => ({label: directory, value: directory})),
  })
  return selectAppDoctorApp(discovery, chosen)
}

/**
 * The engine only asks for a choice (`selection-required`) when `interactive`
 * is true, so reaching this function means prompting is allowed.
 */
async function chooseConfiguration(
  configurations: ReadonlyArray<AppDoctorConfiguration>,
): Promise<AppDoctorConfigurationSelection> {
  const fileNames = configurations.map((configuration) => configuration.fileName)
  const chosen = await renderSelectPrompt({
    message: "Couldn't find your cached configuration file. Which one do you want to use?",
    choices: fileNames.map((fileName) => ({label: fileName, value: fileName})),
  })
  const configuration = configurations.find((candidate) => candidate.fileName === chosen)
  if (!configuration) throw new AbortError(`${chosen} is not one of the available configuration files.`)
  return {configuration, source: 'prompt'}
}

async function resolve(options: ResolveAppDoctorContextOptions): Promise<AppDoctorContext> {
  const {directory, configName, clientId, interactive, appStorage} = options
  const discovery = await discoverAppDoctorApps({directory})
  const app = await chooseApp(discovery, interactive)
  const configurations = await inspectAppDoctorConfigurations(app.directory)
  const decision = selectAppDoctorConfiguration(configurations, {
    explicitConfigurationPath: discovery.explicitConfigurationPath,
    configName,
    clientId,
    // Keyed by the canonical (realpath) app root, whereas other commands key the cache by
    // `normalizePath(directory)` without realpath. A symlinked checkout may therefore miss its
    // cached preference and fall back to the default; deliberate, per the canonical-path rule.
    cachedConfigName: getCachedAppInfo(app.directory, appStorage)?.configFile,
    interactive,
  })
  const selection =
    decision.type === 'selected' ? decision.selection : await chooseConfiguration(decision.configurations)
  return createAppDoctorContext(selection)
}

/**
 * Resolve the local app and configuration exactly once for this invocation.
 * Prompts at most once for the app and once for the configuration, and only
 * when `interactive` is true.
 */
export async function resolveAppDoctorContext(options: ResolveAppDoctorContextOptions): Promise<AppDoctorContext> {
  try {
    return await resolve(options)
  } catch (error) {
    if (error instanceof AppDoctorContextError) {
      throw new AbortError(error.message, TRY_MESSAGES[error.code] ?? null)
    }
    throw error
  }
}
