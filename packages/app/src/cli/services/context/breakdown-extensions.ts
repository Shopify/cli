import {ensureExtensionsIds} from './identifiers-extensions.js'
import {EnsureDeploymentIdsPresenceOptions, LocalSource, RemoteSource} from './identifiers.js'
import {versionDiffByVersion} from '../release/version-diff.js'
import {AppVersionsDiffExtensionSchema} from '../../api/graphql/app_versions_diff.js'
import {AppInterface, CurrentAppConfiguration, filterNonVersionedAppFields} from '../../models/app/app.js'
import {buildDiffConfigContent} from '../../prompts/config.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {ActiveAppVersionQuerySchema, AppModuleVersion} from '../../api/graphql/app_active_version.js'
import {fetchAppRemoteConfiguration, remoteAppConfigurationExtensionContent} from '../app/select-app.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'

export interface ConfigExtensionIdentifiersBreakdown {
  existingFieldNames: string[]
  existingUpdatedFieldNames: string[]
  newFieldNames: string[]
  deletedFieldNames: string[]
}

export interface ExtensionIdentifierBreakdownInfo {
  title: string
  experience: 'extension' | 'dashboard'
}

export function buildExtensionBreakdownInfo(title: string): ExtensionIdentifierBreakdownInfo {
  return {title, experience: 'extension'}
}

export function buildDashboardBreakdownInfo(title: string): ExtensionIdentifierBreakdownInfo {
  return {title, experience: 'dashboard'}
}

export interface ExtensionIdentifiersBreakdown {
  onlyRemote: ExtensionIdentifierBreakdownInfo[]
  toCreate: ExtensionIdentifierBreakdownInfo[]
  toUpdate: ExtensionIdentifierBreakdownInfo[]
}

export async function extensionsIdentifiersDeployBreakdown(options: EnsureDeploymentIdsPresenceOptions) {
  const remoteExtensionsRegistrations = await options.developerPlatformClient.appExtensionRegistrations(options.appId)

  const extensionsToConfirm = await ensureExtensionsIds(options, remoteExtensionsRegistrations.app)
  let extensionIdentifiersBreakdown = loadLocalExtensionsIdentifiersBreakdown(extensionsToConfirm)
  if (options.release) {
    extensionIdentifiersBreakdown = await resolveRemoteExtensionIdentifiersBreakdown(
      options.developerPlatformClient,
      options.appId,
      extensionsToConfirm.validMatches,
      extensionsToConfirm.extensionsToCreate,
      extensionsToConfirm.dashboardOnlyExtensions,
    )
  }
  return {
    extensionIdentifiersBreakdown,
    extensionsToConfirm,
    remoteExtensionsRegistrations: remoteExtensionsRegistrations.app,
  }
}

export async function extensionsIdentifiersReleaseBreakdown(token: string, apiKey: string, version: string) {
  const {versionsDiff, versionDetails} = await versionDiffByVersion(apiKey, version, token)

  const mapIsExtension = (extensions: AppVersionsDiffExtensionSchema[]) =>
    extensions
      .filter((extension) => extension.specification.experience === 'extension')
      .map((extension) => buildExtensionBreakdownInfo(extension.registrationTitle))
  const mapIsDashboard = (extensions: AppVersionsDiffExtensionSchema[]) =>
    extensions
      .filter((extension) => extension.specification.options.managementExperience === 'dashboard')
      .map((extension) => buildDashboardBreakdownInfo(extension.registrationTitle))

  const extensionIdentifiersBreakdown = {
    onlyRemote: [...mapIsExtension(versionsDiff.removed), ...mapIsDashboard(versionsDiff.removed)],
    toCreate: [...mapIsExtension(versionsDiff.added), ...mapIsDashboard(versionsDiff.added)],
    toUpdate: [...mapIsExtension(versionsDiff.updated), ...mapIsDashboard(versionsDiff.updated)],
  }

  return {extensionIdentifiersBreakdown, versionDetails}
}

export async function configExtensionsIdentifiersBreakdown({
  developerPlatformClient,
  apiKey,
  localApp,
  versionAppModules,
  release,
}: {
  developerPlatformClient: DeveloperPlatformClient
  apiKey: string
  localApp: AppInterface
  versionAppModules?: AppModuleVersion[]
  release?: boolean
}) {
  if (localApp.allExtensions.filter((extension) => extension.isAppConfigExtension).length === 0) return
  if (!release) return loadLocalConfigExtensionIdentifiersBreakdown(localApp)

  return resolveRemoteConfigExtensionIdentifiersBreakdown(developerPlatformClient, apiKey, localApp, versionAppModules)
}

function loadLocalConfigExtensionIdentifiersBreakdown(app: AppInterface): ConfigExtensionIdentifiersBreakdown {
  return {
    existingFieldNames: filterNonVersionedAppFields(app.configuration),
    existingUpdatedFieldNames: [] as string[],
    newFieldNames: [] as string[],
    deletedFieldNames: [] as string[],
  }
}

async function resolveRemoteConfigExtensionIdentifiersBreakdown(
  developerPlatformClient: DeveloperPlatformClient,
  apiKey: string,
  app: AppInterface,
  versionAppModules?: AppModuleVersion[],
) {
  const remoteConfig = await fetchAppRemoteConfiguration(
    apiKey,
    developerPlatformClient,
    app.specifications ?? [],
    app.remoteBetaFlags,
  )
  const baselineConfig = versionAppModules
    ? remoteAppConfigurationExtensionContent(versionAppModules, app.specifications ?? [], app.remoteBetaFlags)
    : app.configuration
  const diffConfigContent = buildDiffConfigContent(
    baselineConfig as CurrentAppConfiguration,
    remoteConfig,
    app.configSchema,
    false,
  )

  // List of field included in the config except the ones that only affect the CLI and are not pushed to the server
  // (versioned fields)
  const versionedLocalFieldNames = filterNonVersionedAppFields(baselineConfig)
  // List of remote fields that have different values to the local ones or are not present in the local config
  const remoteDiffModifications = diffConfigContent
    ? getFieldsFromDiffConfigContent(diffConfigContent.baselineContent)
    : []
  // List of local fields that have different values to the remote ones or  are not present in the remote config
  const localDiffModifications = diffConfigContent
    ? getFieldsFromDiffConfigContent(diffConfigContent.updatedContent)
    : []
  // List of versioned field that exists locally and remotely and have the same value
  const notModifiedVersionedLocalFieldNames = versionedLocalFieldNames.filter(
    (field) => !remoteDiffModifications.includes(field) && !localDiffModifications.includes(field),
  )
  // List of versioned field that exists locally and remotely and have different values
  const modifiedVersionedLocalFieldNames = versionedLocalFieldNames.filter(
    (field) => remoteDiffModifications.includes(field) && localDiffModifications.includes(field),
  )
  // List of versioned field that exists locally but not remotely
  const newVersionedLocalFieldNames = localDiffModifications.filter(
    (field) => !remoteDiffModifications.includes(field) && versionedLocalFieldNames.includes(field),
  )
  // List of versioned field that exists remotely but not locally
  // `handle` property won't be temporary shown in the list of removed properties
  const deletedVersionedLocalFieldNames = remoteDiffModifications.filter(
    (field) => !localDiffModifications.includes(field) && field !== 'handle',
  )

  return {
    existingFieldNames: notModifiedVersionedLocalFieldNames,
    existingUpdatedFieldNames: modifiedVersionedLocalFieldNames,
    newFieldNames: newVersionedLocalFieldNames,
    deletedFieldNames: deletedVersionedLocalFieldNames,
  }
}

/**
 * This method extracts the list of global fields or global sections from the string that represents a toml section like
 * this:
 *        embedded = true
 *
 *        [access_scopes]
 *        scopes = "read_products,write_products,write_discounts"
 *
 *        [webhooks.privacy_compliance]
 *        customer_deletion_url = "https://myhooks.dev/apps/customer_deletion_url_edited"
 *
 * Each block is separated by a breaking line. The method will the extract
 * the `field`  following these patterns:
 * - <field> = <value> (in this case all the fields inside the block that matches the pattern will be returned)
 * - [<field>]
 * - [\<field.subsection\>]
 *
 * @param diffConfigContent - The toml string to parse
 * @returns The list of fields
 */
function getFieldsFromDiffConfigContent(diffConfigContent: string): string[] {
  const fields = diffConfigContent
    // Split the input string into sections by one or more blank lines
    .split(/\n\s*\n/)
    .flatMap((section) => {
      // Split each section into lines
      const lines = section.split('\n')
      if (lines.length === 0) return []
      // Match the first line of the section against a regular expression to extract the first field name based on the
      // described patterns
      const firstLineMatch = lines[0]!.match(/^(?:\[(\w+)|(\w+)\s*=)/)
      if (!firstLineMatch) return []
      // Extract the first field name from the appropriate capture group
      const firstFieldName = firstLineMatch[1] || firstLineMatch[2]
      if (!firstFieldName) return []
      // Return field if matches either the pattern [\<field.subsection\>] or [<field>]
      if (firstFieldName.includes('.')) return [firstFieldName.split('.')[0]]
      // If the first line of the section matches the pattern  <field> = <value> extract the following
      // <field> = <value>  that match that condition until the section is finished
      const otherFieldNames = firstLineMatch[2]
        ? lines
            .slice(1)
            .map((line) => line.match(/^(\w+)\s*=/))
            .filter(Boolean)
            .map((match) => match![1])
        : []
      return [firstFieldName, ...otherFieldNames]
    })
    .filter((match): match is string => match !== undefined)

  // Return the list of fields without duplicates
  return Array.from(new Set(fields))
}

function loadLocalExtensionsIdentifiersBreakdown({
  validMatches: localRegistration,
  extensionsToCreate: localSourceToCreate,
  dashboardOnlyExtensions,
}: {
  validMatches: IdentifiersExtensions
  extensionsToCreate: LocalSource[]
  dashboardOnlyExtensions: RemoteSource[]
}): ExtensionIdentifiersBreakdown {
  const identifiersToUpdate = Object.keys(localRegistration).map(buildExtensionBreakdownInfo)
  const identifiersToCreate = localSourceToCreate.map((source) => buildExtensionBreakdownInfo(source.localIdentifier))
  const dashboardToUpdate = dashboardOnlyExtensions
    .filter((dashboard) => !Object.values(localRegistration).includes(dashboard.uuid))
    .map((dashboard) => buildDashboardBreakdownInfo(dashboard.title))
  return {
    onlyRemote: [] as ExtensionIdentifierBreakdownInfo[],
    toCreate: [] as ExtensionIdentifierBreakdownInfo[],
    toUpdate: [...identifiersToUpdate, ...identifiersToCreate, ...dashboardToUpdate],
  }
}

async function resolveRemoteExtensionIdentifiersBreakdown(
  developerPlatformClient: DeveloperPlatformClient,
  apiKey: string,
  localRegistration: IdentifiersExtensions,
  toCreate: LocalSource[],
  dashboardOnly: RemoteSource[],
): Promise<ExtensionIdentifiersBreakdown> {
  const activeAppVersion = await developerPlatformClient.activeAppVersion(apiKey)

  const extensionIdentifiersBreakdown = loadExtensionsIdentifiersBreakdown(
    activeAppVersion,
    localRegistration,
    toCreate,
  )

  const dashboardOnlyFinal = dashboardOnly.filter(
    (dashboardOnly) =>
      !Object.values(localRegistration).includes(dashboardOnly.uuid) &&
      !toCreate.map((source) => source.localIdentifier).includes(dashboardOnly.uuid),
  )
  const dashboardIdentifiersBreakdown = loadDashboardIdentifiersBreakdown(dashboardOnlyFinal, activeAppVersion)

  return {
    onlyRemote: [...extensionIdentifiersBreakdown.onlyRemote, ...dashboardIdentifiersBreakdown.onlyRemote],
    toCreate: [...extensionIdentifiersBreakdown.toCreate, ...dashboardIdentifiersBreakdown.toCreate],
    toUpdate: [...extensionIdentifiersBreakdown.toUpdate, ...dashboardIdentifiersBreakdown.toUpdate],
  }
}

function loadExtensionsIdentifiersBreakdown(
  activeAppVersion: ActiveAppVersionQuerySchema,
  localRegistration: IdentifiersExtensions,
  toCreate: LocalSource[],
) {
  const extensionModules =
    activeAppVersion.app.activeAppVersion?.appModuleVersions.filter(
      (module) => !module.specification || module.specification.experience === 'extension',
    ) || []

  const extensionsToUpdate = Object.entries(localRegistration)
    .filter(([_identifier, uuid]) => extensionModules.map((module) => module.registrationUuid).includes(uuid))
    .map(([identifier, _uuid]) => identifier)

  let extensionsToCreate = Object.entries(localRegistration)
    .filter(([_identifier, uuid]) => !extensionModules.map((module) => module.registrationUuid).includes(uuid))
    .map(([identifier, _uuid]) => identifier)
  extensionsToCreate = Array.from(new Set(extensionsToCreate.concat(toCreate.map((source) => source.localIdentifier))))

  const extensionsOnlyRemote = extensionModules
    .filter(
      (module) =>
        !Object.values(localRegistration).includes(module.registrationUuid) &&
        !toCreate.map((source) => source.localIdentifier).includes(module.registrationUuid),
    )
    .map((module) => module.registrationTitle)

  return {
    onlyRemote: extensionsOnlyRemote.map(buildExtensionBreakdownInfo),
    toCreate: extensionsToCreate.map(buildExtensionBreakdownInfo),
    toUpdate: extensionsToUpdate.map(buildExtensionBreakdownInfo),
  }
}

function loadDashboardIdentifiersBreakdown(
  currentRegistrations: RemoteSource[],
  activeAppVersion: ActiveAppVersionQuerySchema,
) {
  const currentVersions =
    activeAppVersion.app.activeAppVersion?.appModuleVersions.filter(
      (module) => module.specification!.options.managementExperience === 'dashboard',
    ) || []

  const versionsNotIncluded = (version: AppModuleVersion) =>
    !currentRegistrations.map((registration) => registration.uuid).includes(version.registrationUuid)
  const onlyRemote = currentVersions
    .filter(versionsNotIncluded)
    .map((module) => buildDashboardBreakdownInfo(module.registrationTitle))

  const registrationIncluded = (registration: RemoteSource) =>
    currentVersions.map((version) => version.registrationUuid).includes(registration.uuid)
  const registrationNotIncluded = (registration: RemoteSource) => !registrationIncluded(registration)
  const toCreate = currentRegistrations
    .filter(registrationNotIncluded)
    .map((registration) => buildDashboardBreakdownInfo(registration.title))
  const toUpdate = currentRegistrations
    .filter(registrationIncluded)
    .map((registration) => buildDashboardBreakdownInfo(registration.title))

  return {
    onlyRemote,
    toCreate,
    toUpdate,
  }
}
