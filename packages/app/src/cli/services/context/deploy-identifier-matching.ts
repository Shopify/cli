import {
  buildDashboardBreakdownInfo,
  buildConfigExtensionIdentifiersBreakdown,
  buildExtensionBreakdownInfo,
  ExtensionIdentifiersBreakdown,
} from './breakdown-extensions.js'
import {activeAppVersionAfterMigrations} from './deploy-app-version-migrations.js'
import {EnsureDeploymentIdsPresenceOptions} from './identifiers.js'
import {remoteAppConfigurationExtensionContent} from '../app/select-app.js'
import {AppInterface} from '../../models/app/app.js'
import {DeployIdentifiers, ExtensionUuidsByLocalIdentifier} from '../../models/app/identifiers.js'
import {MinimalOrganizationApp} from '../../models/organization.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {deployOrReleaseConfirmationPrompt} from '../../prompts/deploy-release.js'
import {AppModuleVersion, AppVersion} from '../../utilities/developer-platform-client.js'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {deepMergeObjects} from '@shopify/cli-kit/common/object'
import {slugify} from '@shopify/cli-kit/common/string'

type DeployExtensionChangeStatus = 'created' | 'updated' | 'deleted' | 'unchanged'

interface DeployExtensionChange {
  status: DeployExtensionChangeStatus
  experience: 'configuration' | 'extension' | 'deprecated'
  local?: ExtensionInstance
  remote?: AppModuleVersion
}

interface ClassifyDeployExtensionChangesOptions {
  options: EnsureDeploymentIdsPresenceOptions
  activeAppVersion?: AppVersion
}

/** Builds deploy identifiers after migration, classification, and confirmation. */
export async function ensureDeployIdentifiersFromAppVersion(
  options: EnsureDeploymentIdsPresenceOptions,
): Promise<DeployIdentifiers> {
  const activeAppVersion = await activeAppVersionAfterMigrations(options)
  const changes = await classifyDeployExtensionChanges({options, activeAppVersion})
  const extensionIdentifiersBreakdown = buildExtensionIdentifiersBreakdown(changes)
  const configExtensionIdentifiersBreakdown = await buildDeployConfigExtensionIdentifiersBreakdown(
    options,
    activeAppVersion,
  )

  const shouldFetchInstallCount =
    options.release && !options.allowDeletes && extensionIdentifiersBreakdown.onlyRemote.length > 0
  const installCount = shouldFetchInstallCount ? await fetchInstallCount(options).catch(() => undefined) : undefined

  const confirmed = await deployOrReleaseConfirmationPrompt({
    extensionIdentifiersBreakdown,
    configExtensionIdentifiersBreakdown,
    appTitle: options.remoteApp?.title,
    release: options.release,
    allowUpdates: options.allowUpdates,
    allowDeletes: options.allowDeletes,
    installCount,
  })
  if (!confirmed) throw new AbortSilentError()

  return buildDeployIdentifiersFromChanges(changes)
}

/** Classifies local and active-version extensions by deploy outcome. */
export async function classifyDeployExtensionChanges({
  options,
  activeAppVersion,
}: ClassifyDeployExtensionChangesOptions): Promise<DeployExtensionChange[]> {
  const remoteModules = activeAppVersion?.appModuleVersions ?? []
  const allExtensions = options.app.allExtensions
  const envUUIDs = options.envIdentifiers
  const pendingRemotes = remoteModules.filter((remote) => remote.registrationId === '')

  const remoteChanges = remoteModules.map((remote): DeployExtensionChange => {
    if (remote.registrationId === '') {
      // Non-migrated modules flow (temporary, to be removed eventually): match by the stored legacy
      // UUID, then fall back to a unique handle + type match.
      const local =
        allExtensions.find((local) => envUUIDs[local.localIdentifier] === remote.registrationUuid) ??
        uniqueHandleAndTypeMatch(allExtensions, pendingRemotes, remote)
      if (local) return {experience: local.specification.experience, status: 'updated', local, remote}
    } else {
      // Normal flow: the remote module has a UID.
      const local = allExtensions.find((local) => remote.registrationId === local.uid)
      if (local) return {experience: local.specification.experience, status: 'unchanged', local, remote}
    }

    return {experience: remote.specification?.experience ?? 'extension', status: 'deleted', remote}
  })

  const matchedLocals = remoteChanges.map((change) => change.local)
  const createdChanges = allExtensions
    .filter((local) => !matchedLocals.includes(local))
    .map(
      (local): DeployExtensionChange => ({
        experience: local.specification.experience,
        status: 'created',
        local,
      }),
    )

  return [...remoteChanges, ...createdChanges]
}

/**
 * Finds the single local extension that matches a remote by handle and type. Returns undefined when
 * there is no match or when it would be ambiguous — more than one local matches, or more than one
 * un-migrated remote shares that handle and type — so an ambiguous relink is never guessed.
 */
function uniqueHandleAndTypeMatch(
  allExtensions: ExtensionInstance[],
  pendingRemotes: AppModuleVersion[],
  remote: AppModuleVersion,
): ExtensionInstance | undefined {
  const sameHandleAndType = (local: ExtensionInstance, candidate: AppModuleVersion) =>
    slugify(local.handle) === slugify(candidate.registrationTitle) &&
    (local.specification.identifier === candidate.specification?.identifier ||
      local.specification.externalIdentifier === candidate.specification?.identifier)

  const localMatches = allExtensions.filter((local) => sameHandleAndType(local, remote))
  if (localMatches.length !== 1) return undefined

  const local = localMatches[0]!
  const hasCompetingRemote = pendingRemotes.some(
    (candidate) => candidate !== remote && sameHandleAndType(local, candidate),
  )
  return hasCompetingRemote ? undefined : local
}

/** Converts config deploy changes into the existing config prompt breakdown. */
async function buildDeployConfigExtensionIdentifiersBreakdown(
  options: EnsureDeploymentIdsPresenceOptions,
  activeAppVersion: AppVersion | undefined,
): Promise<ReturnType<typeof buildConfigExtensionIdentifiersBreakdown>> {
  const {app, appId} = options
  const localConfig = await localAppConfigurationExtensionContent(app, appId)
  const remoteConfig = remoteAppConfigurationExtensionContent(
    activeAppVersion?.appModuleVersions ?? [],
    app.specifications ?? [],
    app.remoteFlags,
  )

  return buildConfigExtensionIdentifiersBreakdown(localConfig, remoteConfig)
}

/** Converts deploy changes into the existing extension prompt breakdown. */
function buildExtensionIdentifiersBreakdown(changes: DeployExtensionChange[]): ExtensionIdentifiersBreakdown {
  const visibleChanges = changes.filter((change) => change.experience === 'extension')

  return {
    onlyRemote: visibleChanges
      .filter((change) => change.status === 'deleted')
      .map((change) => buildRemoteBreakdownInfo(change.remote!)),
    toCreate: visibleChanges
      .filter((change) => change.status === 'created')
      .map((change) => buildExtensionBreakdownInfo(change.local!.localIdentifier, change.local!.uid)),
    toUpdate: visibleChanges
      .filter((change) => change.status === 'updated')
      .map((change) => buildExtensionBreakdownInfo(change.local!.localIdentifier, undefined)),
    unchanged: visibleChanges
      .filter((change) => change.status === 'unchanged')
      .map((change) => buildExtensionBreakdownInfo(change.local!.localIdentifier, undefined)),
  }
}

/** Converts deploy changes into the identifiers needed by upload. */
function buildDeployIdentifiersFromChanges(changes: DeployExtensionChange[]) {
  const appModuleUuids: ExtensionUuidsByLocalIdentifier = {}
  const appModuleRegistrationIds: ExtensionUuidsByLocalIdentifier = {}

  for (const change of changes) {
    if (!change.local) continue

    const localUID = change.local.uid
    const uuid = change.remote?.registrationUuid ?? localUID
    const registrationId = change.remote?.registrationId ?? localUID
    appModuleUuids[change.local.localIdentifier] = uuid
    appModuleRegistrationIds[change.local.localIdentifier] = registrationId
  }

  return {appModuleUuids, appModuleRegistrationIds}
}

async function localAppConfigurationExtensionContent(app: AppInterface, apiKey: string) {
  let appConfig: {[key: string]: unknown} = {}
  const configExtensions = app.allExtensions.filter((extension) => extension.isAppConfigExtension)

  for (const extension of configExtensions) {
    // eslint-disable-next-line no-await-in-loop
    const deployConfig = await extension.deployConfig({apiKey, appConfiguration: app.configuration})
    const localConfig =
      extension.specification.transformRemoteToLocal?.(deployConfig ?? {}, {flags: app.remoteFlags}) ??
      extension.configuration
    appConfig = deepMergeObjects(appConfig, localConfig)
  }

  return appConfig
}

/** Builds prompt metadata for a remote-only module. */
function buildRemoteBreakdownInfo(remote: AppModuleVersion) {
  if (remote.specification?.options.managementExperience === 'dashboard') {
    return buildDashboardBreakdownInfo(remote.registrationTitle)
  }
  return buildExtensionBreakdownInfo(remote.registrationTitle, remote.registrationId)
}

/** Fetches install count for delete warnings. */
async function fetchInstallCount(options: {
  developerPlatformClient: EnsureDeploymentIdsPresenceOptions['developerPlatformClient']
  remoteApp: MinimalOrganizationApp
}) {
  return options.developerPlatformClient.appInstallCount({
    id: options.remoteApp.id,
    apiKey: options.remoteApp.apiKey,
    organizationId: options.remoteApp.organizationId,
  })
}
