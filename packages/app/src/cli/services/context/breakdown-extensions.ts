import {ensureExtensionsIds} from './identifiers-extensions.js'
import {EnsureDeploymentIdsPresenceOptions, LocalSource, RemoteSource} from './identifiers.js'
import {fetchActiveAppVersion, fetchAppExtensionRegistrations} from '../dev/fetch.js'
import {ExtensionSpecification} from '../../models/extensions/specification.js'
import {versionDiffByVersion} from '../release/version-diff.js'
import {AppVersionsDiffExtensionSchema} from '../../api/graphql/app_versions_diff.js'
import {
  AppInterface,
  CurrentAppConfiguration,
  VersionedAppSchema,
  filterNonVersionedAppFields,
} from '../../models/app/app.js'
import {remoteAppConfigurationExtensionContent} from '../app/config/link.js'
import {buildDiffConfigContent} from '../../prompts/config.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'

export interface ConfigExtensionIdentifiersBreakdown {
  existingFieldNames: string[]
  existingUpdatedFieldNames: string[]
  newFieldNames: string[]
  deletedFieldNames: string[]
}

export interface ExtensionIdentifiersBreakdown {
  onlyRemote: string[]
  toCreate: string[]
  toUpdate: string[]
  fromDashboard: string[]
}

export async function extensionsIdentifiersDeployBreakdown(options: EnsureDeploymentIdsPresenceOptions) {
  const remoteExtensionsRegistrations = await fetchAppExtensionRegistrations({
    token: options.token,
    apiKey: options.appId,
  })

  const extensionsToConfirm = await ensureExtensionsIds(options, remoteExtensionsRegistrations.app)
  let extensionIdentifiersBreakdown = loadLocalExtensionsIdentifiersBreakdown(
    extensionsToConfirm.validMatches,
    extensionsToConfirm.extensionsToCreate,
  )
  if (options.release) {
    extensionIdentifiersBreakdown = await resolveRemoteExtensionIdentifiersBreakdown(
      options.token,
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

export async function extensionsIdentifiersReleaseBreakdown(
  token: string,
  apiKey: string,
  version: string,
  specifications: ExtensionSpecification[],
) {
  const {versionsDiff, versionDetails} = await versionDiffByVersion(apiKey, version, token)

  // The content of the app_config extensions are not included in the versions diff so it's not possible to get the
  // comparison between the version to release and the current active version
  const filterAppConfigExtension = (remoteExtension: AppVersionsDiffExtensionSchema) =>
    !specifications
      .filter((specification) => specification.appModuleFeatures().includes('app_config'))
      .map((specification) => specification.identifier)
      .includes(remoteExtension.specification.identifier)

  const extensionIdentifiersBreakdown = {
    onlyRemote: versionsDiff.removed.filter(filterAppConfigExtension).map((extension) => extension.registrationTitle),
    toCreate: versionsDiff.added.filter(filterAppConfigExtension).map((extension) => extension.registrationTitle),
    toUpdate: versionsDiff.updated.filter(filterAppConfigExtension).map((extension) => extension.registrationTitle),
    // dashboard specs will appear in the oher sections
    fromDashboard: [] as string[],
  }

  return {extensionIdentifiersBreakdown, versionDetails}
}

export async function configExtensionsIdentifiersBreakdown(
  localApp: AppInterface,
  extensionRegistrations: ExtensionRegistration[],
  release?: boolean,
) {
  let configContentBreakdown = loadLocalConfigExtensionIdentifiersBreakdown(localApp)
  if (release) {
    configContentBreakdown = resolveRemoteConfigExtensionIdentifiersBreakdown(extensionRegistrations, localApp)
  }
  return configContentBreakdown
}

function loadLocalConfigExtensionIdentifiersBreakdown(app: AppInterface): ConfigExtensionIdentifiersBreakdown {
  return {
    existingFieldNames: filterNonVersionedAppFields(app),
    existingUpdatedFieldNames: [] as string[],
    newFieldNames: [] as string[],
    deletedFieldNames: [] as string[],
  }
}

function resolveRemoteConfigExtensionIdentifiersBreakdown(
  extensionRegistrations: ExtensionRegistration[],
  app: AppInterface,
): ConfigExtensionIdentifiersBreakdown {
  const remoteConfig = remoteAppConfigurationExtensionContent(extensionRegistrations, app.specifications ?? [])
  const localConfig = app.configuration
  const diffConfigContent = buildDiffConfigContent(
    localConfig as CurrentAppConfiguration,
    remoteConfig,
    VersionedAppSchema,
    false,
  )

  // List of field included in the config except the ones that only affect the CLI and are not pushed to the server
  // (versioned fields)
  const versionedLocalFieldNames = filterNonVersionedAppFields(app)
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
  const deletedVersionedLocalFieldNames = remoteDiffModifications.filter(
    (field) => !localDiffModifications.includes(field),
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

function loadLocalExtensionsIdentifiersBreakdown(
  localRegistration: IdentifiersExtensions,
  localSourceToCreate: LocalSource[],
): ExtensionIdentifiersBreakdown {
  const identifiersToUpdate = Object.keys(localRegistration)
  const identifiersToCreate = localSourceToCreate.map((source) => source.localIdentifier)
  return {
    onlyRemote: [] as string[],
    toCreate: [] as string[],
    toUpdate: [...identifiersToUpdate, ...identifiersToCreate],
    fromDashboard: [] as string[],
  }
}

async function resolveRemoteExtensionIdentifiersBreakdown(
  token: string,
  apiKey: string,
  localRegistration: IdentifiersExtensions,
  toCreate: LocalSource[],
  dashboardOnly: RemoteSource[],
): Promise<ExtensionIdentifiersBreakdown> {
  const activeAppVersion = await fetchActiveAppVersion({token, apiKey})

  const appModuleVersionsNonConfig =
    activeAppVersion.app.activeAppVersion?.appModuleVersions.filter(
      (module) => !module.specification || module.specification.experience !== 'configuration',
    ) || []

  const nonDashboardRemoteRegistrationUuids =
    appModuleVersionsNonConfig
      .filter((module) => module.specification!.options.managementExperience !== 'dashboard')
      .map((remoteRegistration) => remoteRegistration.registrationUuid) ?? []

  let toCreateFinal: string[] = []
  const toUpdate: string[] = []
  let dashboardOnlyFinal = dashboardOnly

  for (const [identifier, uuid] of Object.entries(localRegistration)) {
    if (nonDashboardRemoteRegistrationUuids.includes(uuid)) {
      toUpdate.push(identifier)
    } else {
      toCreateFinal.push(identifier)
    }

    dashboardOnlyFinal = dashboardOnlyFinal.filter((dashboardOnly) => dashboardOnly.uuid !== uuid)
  }

  toCreateFinal = Array.from(new Set(toCreateFinal.concat(toCreate.map((source) => source.localIdentifier))))

  const localRegistrationAndDashboard = [
    ...Object.values(localRegistration),
    ...dashboardOnly.map((source) => source.uuid),
  ]
  const onlyRemote =
    appModuleVersionsNonConfig
      .filter((module) => !localRegistrationAndDashboard.includes(module.registrationUuid))
      .map((module) => module.registrationTitle) ?? []

  return {
    onlyRemote,
    toCreate: toCreateFinal.map((identifier) => identifier),
    toUpdate,
    fromDashboard: dashboardOnlyFinal.map((source) => source.title),
  }
}
