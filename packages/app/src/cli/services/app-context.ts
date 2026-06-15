import {appFromIdentifiers} from './context.js'
import {
  getCachedAppInfo,
  setCachedAppInfo,
  getMostRecentlyUsedAppContext,
  setMostRecentlyUsedAppContext,
} from './local-storage.js'
import {fetchSpecifications} from './generate/fetch-extension-specifications.js'
import link from './app/config/link.js'
import {fetchOrgFromId} from './dev/fetch.js'
import {addUidToTomlsIfNecessary} from './app/add-uid-to-extension-toml.js'
import {loadLocalExtensionsSpecifications} from '../models/extensions/load-specifications.js'
import {Organization, OrganizationApp, OrganizationSource} from '../models/organization.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {
  getAppConfigurationContext,
  loadAppFromContext,
  formatConfigurationError,
  type ConfigurationError,
} from '../models/app/loader.js'
import {RemoteAwareExtensionSpecification} from '../models/extensions/specification.js'
import {AppLinkedInterface, AppInterface} from '../models/app/app.js'
import {Project} from '../models/project/project.js'
import metadata from '../metadata.js'
import {tryParseInt} from '@shopify/cli-kit/common/string'
import {sessionExists} from '@shopify/cli-kit/node/session'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {basename} from '@shopify/cli-kit/node/path'
import type {ActiveConfig} from '../models/project/active-config.js'

function styledConfigurationError(error: ConfigurationError) {
  const formatted = formatConfigurationError(error)
  return outputContent`${outputToken.errorText('Validation error')} in ${outputToken.path(error.file)}:\n\n${formatted}`
}

export interface LoadedAppContextOutput {
  app: AppLinkedInterface
  remoteApp: OrganizationApp
  developerPlatformClient: DeveloperPlatformClient
  organization: Organization
  specifications: RemoteAwareExtensionSpecification[]
  project: Project
  activeConfig: ActiveConfig
}

/**
 * Input options for the `linkedAppContext` function.
 *
 * @param directory - The directory containing the app.
 * @param forceRelink - Whether to force a relink of the app, this includes re-selecting the remote org and app.
 * @param clientId - The client ID to use when linking the app or when fetching the remote app.
 * @param userProvidedConfigName - The name of an existing config file in the app, if not provided, the cached/default one will be used.
 * @param unsafeTolerateErrors - When true, the loaded app may contain validation errors without throwing.
 * Only use this for commands that explicitly handle invalid configs (e.g. `app info`, `app validate`).
 */
interface LoadedAppContextOptions {
  directory: string
  forceRelink: boolean
  clientId: string | undefined
  userProvidedConfigName: string | undefined
  unsafeTolerateErrors?: boolean
}

/**
 * Input options for the `localAppContext` function.
 *
 * @param directory - The directory containing the app.
 * @param userProvidedConfigName - The name of an existing config file in the app, if not provided, the cached/default one will be used.
 * @param skipPrompts - When true, never prompts the user (e.g. to re-select a config). Required for non-interactive callers such as telemetry.
 */
interface LocalAppContextOptions {
  directory: string
  userProvidedConfigName?: string
  skipPrompts?: boolean
}

/**
 * This function always returns an app that has been correctly linked and was loaded using the remote specifications.
 *
 * You can use a custom configName to load a specific config file.
 * In any case, if the selected config file is not linked, this function will force a link.
 *
 * @returns The local app, the remote app, the correct developer platform client, and the remote specifications list.
 */
export async function linkedAppContext({
  directory,
  clientId,
  forceRelink,
  userProvidedConfigName,
  unsafeTolerateErrors = false,
}: LoadedAppContextOptions): Promise<LoadedAppContextOutput> {
  let project: Project
  let activeConfig: ActiveConfig
  let remoteApp: OrganizationApp | undefined

  if (forceRelink) {
    // Skip getAppConfigurationContext() when force-relinking — it may prompt the
    // user to select a TOML file that will be immediately discarded by link().
    const result = await link({directory, apiKey: clientId})
    remoteApp = result.remoteApp
    const reloaded = await getAppConfigurationContext(directory, result.configFileName)
    project = reloaded.project
    activeConfig = reloaded.activeConfig
  } else {
    const loaded = await getAppConfigurationContext(directory, userProvidedConfigName)
    project = loaded.project
    activeConfig = loaded.activeConfig

    if (activeConfig.file.errors.length > 0) {
      throw new AbortError(activeConfig.file.errors.map((err) => err.message).join('\n'))
    }

    if (!activeConfig.isLinked) {
      const result = await link({directory, apiKey: clientId, configName: basename(activeConfig.file.path)})
      remoteApp = result.remoteApp
      const reloaded = await getAppConfigurationContext(directory, result.configFileName)
      project = reloaded.project
      activeConfig = reloaded.activeConfig
    }
  }

  // Determine the effective client ID
  const configClientId = activeConfig.file.content.client_id
  if (typeof configClientId !== 'string' || configClientId.length === 0) {
    throw new BugError(`Active config at ${activeConfig.file.path} is marked as linked but has no client_id`)
  }
  const effectiveClientId = clientId ?? configClientId

  // Fetch the remote app, using a different clientID if provided via flag.
  remoteApp ??= await appFromIdentifiers({apiKey: effectiveClientId})
  const developerPlatformClient = remoteApp.developerPlatformClient

  const organization = await fetchOrgFromId(remoteApp.organizationId, developerPlatformClient)

  // Fetch the remote app's specifications
  const specifications = await fetchSpecifications({developerPlatformClient, app: remoteApp})

  // Load the local app using the pre-resolved context and the remote app's specifications
  const localApp = await loadAppFromContext({
    project,
    activeConfig,
    specifications,
    remoteFlags: remoteApp.flags,
    clientIdOverride: clientId && clientId !== configClientId ? clientId : undefined,
  })

  if (!unsafeTolerateErrors && !localApp.errors.isEmpty()) {
    throw new AbortError(styledConfigurationError(localApp.errors.getErrors()[0]!))
  }

  // If the remoteApp is the same as the linked one, update the cached info.
  const cachedInfo = getCachedAppInfo(directory)
  const rightApp = remoteApp.apiKey === localApp.configuration.client_id
  if (!cachedInfo || rightApp) {
    setCachedAppInfo({appId: remoteApp.apiKey, title: remoteApp.title, directory, orgId: remoteApp.organizationId})
  }

  await logMetadata(remoteApp, organization, forceRelink)

  // Add UIDs to extension TOML files if using app-management.
  // Only safe when there are no errors — errors may mean UIDs weren't loaded correctly.
  if (localApp.errors.isEmpty()) {
    await addUidToTomlsIfNecessary(localApp.allExtensions, developerPlatformClient)
  }

  return {project, activeConfig, app: localApp, remoteApp, developerPlatformClient, specifications, organization}
}

async function logMetadata(app: {apiKey: string}, organization: Organization, resetUsed: boolean) {
  let organizationInfo: {partner_id?: number; business_platform_id?: number}
  if (organization.source === OrganizationSource.BusinessPlatform) {
    organizationInfo = {business_platform_id: tryParseInt(organization.id)}
  } else {
    organizationInfo = {partner_id: tryParseInt(organization.id)}
  }

  await metadata.addPublicMetadata(() => ({
    ...organizationInfo,
    api_key: app.apiKey,
    cmd_app_reset_used: resetUsed,
  }))
}

interface LocalAppContextOutput {
  app: AppInterface
  project: Project
}

/**
 * This function loads an app locally without making any network calls.
 * It uses local specifications and doesn't require the app to be linked.
 *
 * @returns The local app and project instances.
 */
export async function localAppContext({
  directory,
  userProvidedConfigName,
  skipPrompts = false,
}: LocalAppContextOptions): Promise<LocalAppContextOutput> {
  const {project, activeConfig} = await getAppConfigurationContext(directory, userProvidedConfigName, {skipPrompts})

  if (activeConfig.file.errors.length > 0) {
    throw new AbortError(activeConfig.file.errors.map((err) => err.message).join('\n'))
  }

  const specifications = await loadLocalExtensionsSpecifications()
  const app = await loadAppFromContext({project, activeConfig, specifications, ignoreUnknownExtensions: true})

  if (!app.errors.isEmpty()) {
    throw new AbortError(styledConfigurationError(app.errors.getErrors()[0]!))
  }

  return {app, project}
}

// Upper bound on the best-effort app-context load below. It runs on the postrun of
// every command, so it must never delay process exit, even on a pathological project.
const APP_CONTEXT_METADATA_TIMEOUT_MS = 3000

type AppMetadataPublic = ReturnType<typeof metadata.getAllPublicMetadata>
type AppMetadataSensitive = ReturnType<typeof metadata.getAllSensitiveMetadata>

// Sensitive metadata fields that are part of "app context" and worth replaying for
// out-of-app commands. Kept tiny and explicit so we never persist more than intended.
const APP_CONTEXT_SENSITIVE_KEYS = ['app_name']

/**
 * Whether a public metadata key is part of the app-context block emitted when an app loads
 * (see `logMetadataForLoadedAppUsingRawValues` in the loader). These are the fields we
 * snapshot and replay so a command run outside an app directory looks like one run inside.
 * Deliberately excludes per-run `cmd_app_*` flags (e.g. `cmd_app_warning_*`,
 * `cmd_app_reset_used`) that describe the command rather than the app's identity/shape.
 */
function isAppContextPublicKey(key: string): boolean {
  return (
    key === 'api_key' ||
    key === 'project_type' ||
    key.startsWith('app_') ||
    key.startsWith('cmd_app_all_configs_') ||
    key.startsWith('cmd_app_linked_config_')
  )
}

/**
 * Snapshots the app-context fields currently in the metadata container and records them as
 * the most-recently-used app, so later commands run outside an app directory can replay
 * them. No-op unless a non-empty `api_key` is present (i.e. an app actually resolved).
 */
function recordMostRecentlyUsedAppContext(): void {
  const allPublic = metadata.getAllPublicMetadata()
  if (typeof allPublic.api_key !== 'string' || allPublic.api_key.length === 0) return

  const publicContext: {[key: string]: unknown} = {}
  for (const [key, value] of Object.entries(allPublic)) {
    if (value !== undefined && isAppContextPublicKey(key)) publicContext[key] = value
  }

  const allSensitive = metadata.getAllSensitiveMetadata() as {[key: string]: unknown}
  const sensitiveContext: {[key: string]: unknown} = {}
  for (const key of APP_CONTEXT_SENSITIVE_KEYS) {
    if (allSensitive[key] !== undefined) sensitiveContext[key] = allSensitive[key]
  }

  setMostRecentlyUsedAppContext({public: publicContext, sensitive: sensitiveContext})
}

/**
 * Best-effort, non-interactive enrichment of command analytics with app context.
 *
 * Attaches the full app-context block (`api_key`, `project_type`, and the `app_*` /
 * `cmd_app_*` fields the loader emits) to the Monorail metadata so that every command — not
 * just app commands — is attributed to an app for authenticated users. It resolves the app
 * from one of two sources, recorded in the `cmd_app_context_source` field:
 *   1. `"current_directory"` — `directory` is an app project, loaded from disk (no network,
 *      no prompts). This is the authoritative source; its full context is also snapshotted
 *      as the "most recently used" app for later.
 *   2. `"last_used"` — `directory` is not an app project, so the previously snapshotted
 *      most-recently-used app context is replayed in full (public fields plus the sensitive
 *      `app_name`). This lets commands run *outside* any app directory (e.g. from a parent
 *      folder) still be attributed to the app the user was last working with.
 *
 * `cmd_app_context_source` is the explicit discriminator between the two; the absence of the
 * loader-only `cmd_app_linked_config_*` fields on a `"last_used"` event is a secondary tell.
 *
 * It is designed to run on the postrun of every CLI command, so it:
 *   - does nothing unless the user is already logged in (so we never enrich anonymous usage),
 *   - when `api_key` is already set (a command like `app dev` already loaded the app), tags
 *     the source and snapshots that app as most-recently-used, but does no further work,
 *   - never prompts, never makes a network request,
 *   - is bounded by a short timeout so it can't delay command exit, and
 *   - swallows all errors (a directory that isn't an app, an invalid config, etc.).
 *
 * @param directory - The working directory to inspect for an app.
 */
export async function logAppContextMetadataIfAuthenticated(directory: string): Promise<void> {
  try {
    const existingApiKey = metadata.getAllPublicMetadata().api_key
    if (typeof existingApiKey === 'string' && existingApiKey.length > 0) {
      // A command (e.g. `app dev`) already resolved and emitted the full app context. Tag it
      // as a real load and remember it so later out-of-app commands can replay it.
      await metadata.addPublicMetadata(() => ({cmd_app_context_source: 'current_directory'}))
      recordMostRecentlyUsedAppContext()
      return
    }
    if (!(await sessionExists())) return

    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, APP_CONTEXT_METADATA_TIMEOUT_MS)
    })

    const load = (async () => {
      try {
        const {app} = await localAppContext({directory, skipPrompts: true})
        const clientId = app.configuration.client_id
        if (typeof clientId === 'string' && clientId.length > 0) {
          // localAppContext drove the loader, which already populated project_type and the
          // app_* block. Add api_key + the source tag, then snapshot the whole thing.
          await metadata.addPublicMetadata(() => ({api_key: clientId, cmd_app_context_source: 'current_directory'}))
          recordMostRecentlyUsedAppContext()
          return
        }
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch {
        // `directory` isn't an app project (or it's unreadable) — fall back to the most
        // recently used app below.
      }

      const recent = getMostRecentlyUsedAppContext()
      const recentApiKey = recent?.public?.api_key
      if (typeof recentApiKey === 'string' && recentApiKey.length > 0) {
        await metadata.addPublicMetadata(
          () => ({...recent!.public, cmd_app_context_source: 'last_used'}) as unknown as AppMetadataPublic,
        )
        if (recent!.sensitive && Object.keys(recent!.sensitive).length > 0) {
          await metadata.addSensitiveMetadata(() => ({...recent!.sensitive}) as unknown as AppMetadataSensitive)
        }
      }
    })()

    try {
      await Promise.race([load, deadline])
    } finally {
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // Telemetry is strictly best-effort: never surface errors or affect the command.
  }
}
