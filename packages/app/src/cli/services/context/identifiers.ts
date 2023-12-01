import {deployConfirmed, resolveExtensionsIds} from './identifiers-extensions.js'
import {AppInterface, AppSchema} from '../../models/app/app.js'
import {Identifiers, IdentifiersExtensions} from '../../models/app/identifiers.js'
import {fetchActiveAppVersion, fetchAppExtensionRegistrations} from '../dev/fetch.js'
import {MinimalOrganizationApp} from '../../models/organization.js'
import {getRemoteAppConfig} from '../app/config/link.js'
import {DiffContent, buildDiffConfigContent} from '../../prompts/config.js'
import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {versionDiffByVersion} from '../release/version-diff.js'
import {AppVersionsDiffExtensionSchema} from '../../api/graphql/app_versions_diff.js'
import {ConfigExtensionSpecification} from '../../models/extensions/specification.js'
import {deployOrReleaseConfirmationPrompt} from '../../prompts/deploy-release.js'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

export type PartnersAppForIdentifierMatching = MinimalOrganizationApp

export interface EnsureDeploymentIdsPresenceOptions {
  app: AppInterface
  token: string
  appId: string
  appName: string
  envIdentifiers: Partial<Identifiers>
  force: boolean
  release: boolean
  partnersApp: PartnersAppForIdentifierMatching
  diffConfigContent?: DiffContent
}

export interface RemoteSource {
  uuid: string
  type: string
  id: string
  title: string
  draftVersion?: {config: string}
}

export interface LocalSource {
  localIdentifier: string
  graphQLType: string
  type: string
  handle: string
}

export async function ensureDeploymentIdsPresence(options: EnsureDeploymentIdsPresenceOptions) {
  const remoteExtensions = await fetchAppExtensionRegistrations({token: options.token, apiKey: options.appId})

  const extensionsToConfirm = await resolveExtensionsIds(options, remoteExtensions.app)
  let extensionIdentifiersBreakdown = loadLocalExtensionsIdentifiersBreakdown(extensionsToConfirm.validMatches)
  if (options.release) {
    extensionIdentifiersBreakdown = await resolveRemoteExtensionIdentifiersBreakdown(
      options.token,
      options.appId,
      extensionsToConfirm.validMatches,
      extensionsToConfirm.extensionsToCreate,
      extensionsToConfirm.dashboardOnlyExtensions,
    )
  }
  const confirmed = await deployOrReleaseConfirmationPrompt({
    extensionIdentifiersBreakdown,
    configExtensionRegistrations: remoteExtensions.app.configExtensionRegistrations,
    remoteApp: options.partnersApp,
    localApp: options.app,
    release: options.release,
    force: options.force,
  })
  if (!confirmed) throw new AbortSilentError()

  const result = await deployConfirmed(options, remoteExtensions.app.extensionRegistrations, extensionsToConfirm)

  return {
    app: options.appId,
    extensions: result.extensions,
    extensionIds: result.extensionIds,
  }
}

export interface ConfigExtensionIdentifiersBreakdown {
  existingFieldNames: string[]
  existingUpdatedFieldNames: string[]
  newFieldNames: string[]
  deletedFieldNames: string[]
}

export function loadLocalConfigExtensionIdentifiersBreakdown(app: AppInterface): ConfigExtensionIdentifiersBreakdown {
  return {
    existingFieldNames: getLocalConfigurationFieldNames(app),
    existingUpdatedFieldNames: [] as string[],
    newFieldNames: [] as string[],
    deletedFieldNames: [] as string[],
  }
}

export function resolveRemoteConfigExtensionIdentifiersBreakdown(
  configExtensionRegistrations: ExtensionRegistration[],
  app: AppInterface,
  remoteApp: PartnersAppForIdentifierMatching,
): ConfigExtensionIdentifiersBreakdown {
  const remoteConfig = getRemoteAppConfig(
    configExtensionRegistrations,
    app.specifications.configSpecifications,
    remoteApp,
  )
  const localConfig = app.configuration
  const diffConfigContent = buildDiffConfigContent(localConfig, remoteConfig, app.configSchema, false)

  // List of field included in the config except the ones that are not pushed to the server included in the AppSchema
  const schemaFieldNames = getLocalConfigurationFieldNames(app)
  const remoteModifiedFieldNames = diffConfigContent
    ? getFieldsFromDiffConfigContent(diffConfigContent.baselineContent)
    : []
  const localModifiedFieldNames = diffConfigContent
    ? getFieldsFromDiffConfigContent(diffConfigContent.updatedContent)
    : []
  const existingFieldNames = schemaFieldNames.filter(
    (field) => !remoteModifiedFieldNames.includes(field) && !localModifiedFieldNames.includes(field),
  )
  const existingUpdatedFieldNames = schemaFieldNames.filter(
    (field) => remoteModifiedFieldNames.includes(field) && localModifiedFieldNames.includes(field),
  )
  const newFieldNames = localModifiedFieldNames.filter((field) => !remoteModifiedFieldNames.includes(field))

  const deletedFieldNames = remoteModifiedFieldNames.filter((field) => !localModifiedFieldNames.includes(field))

  return {
    existingFieldNames,
    existingUpdatedFieldNames,
    newFieldNames,
    deletedFieldNames,
  }
}

function getLocalConfigurationFieldNames(app: AppInterface) {
  return Object.keys(app.configuration).filter(
    (fieldName) => !Object.keys(AppSchema.shape).concat('path').includes(fieldName),
  )
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

export interface ExtensionIdentifiersBreakdown {
  onlyRemote: string[]
  toCreate: string[]
  toUpdate: string[]
  fromDashboard: string[]
}

function loadLocalExtensionsIdentifiersBreakdown(
  localRegistration: IdentifiersExtensions,
): ExtensionIdentifiersBreakdown {
  return {
    onlyRemote: [] as string[],
    toCreate: [] as string[],
    toUpdate: Object.keys(localRegistration),
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
      (module) => module.specification !== null && module.specification?.options.managementExperience !== 'app_config',
    ) || []

  const nonDashboardRemoteRegistrationUuids =
    appModuleVersionsNonConfig
      .filter((module) => !module.specification || module.specification.options.managementExperience !== 'dashboard')
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

export async function resolveVersionDiffExtensionIdentifiersBreakdown(
  token: string,
  apiKey: string,
  version: string,
  configSpecifications: ConfigExtensionSpecification[],
) {
  const {versionsDiff} = await versionDiffByVersion(apiKey, version, token)

  const filterAppConfigExtension = (remoteExtension: AppVersionsDiffExtensionSchema) =>
    !configSpecifications
      .map((specification) => specification.identifier)
      .includes(remoteExtension.specification.identifier)

  return {
    onlyRemote: versionsDiff.removed.filter(filterAppConfigExtension).map((extension) => extension.registrationTitle),
    toCreate: versionsDiff.added.filter(filterAppConfigExtension).map((extension) => extension.registrationTitle),
    toUpdate: versionsDiff.updated.filter(filterAppConfigExtension).map((extension) => extension.registrationTitle),
    fromDashboard: [] as string[],
  }
}
