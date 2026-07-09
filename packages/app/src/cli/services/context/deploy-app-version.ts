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
  const app = options.app
  const localChanges = await Promise.all(
    app.allExtensions.map(async (local): Promise<DeployExtensionChange> => {
      const experience = local.specification.experience
      const remoteMatchByUID = remoteModules.find((remote) => remote.registrationId === local.uid)
      if (remoteMatchByUID) {
        return {experience, status: 'unchanged', local, remote: remoteMatchByUID}
      }

      // Legacy match by UUID, used only if extensions are not migrated and don't have a remote UID.
      const localUUID = options.envIdentifiers[local.localIdentifier]
      const remoteByUUID = localUUID ? remoteModules.find((remote) => remote.registrationUuid === localUUID) : undefined
      if (remoteByUUID) {
        return {experience, status: 'updated', local, remote: remoteByUUID}
      }

      return {experience, status: 'created', local}
    }),
  )

  const matchedRemoteModules = localChanges.map((change) => change.remote)
  const deletedChanges = remoteModules
    .filter((remote) => !matchedRemoteModules.includes(remote))
    .map(
      (remote): DeployExtensionChange => ({
        experience: remote.specification?.experience ?? 'extension',
        status: 'deleted',
        remote,
      }),
    )

  return [...localChanges, ...deletedChanges]
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
