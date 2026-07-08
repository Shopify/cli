import {versionDiffByVersion} from '../release/version-diff.js'
import {AppVersionsDiffExtensionSchema} from '../../api/graphql/app_versions_diff.js'
import {AppInterface} from '../../models/app/app.js'
import {MinimalOrganizationApp} from '../../models/organization.js'
import {remoteAppConfigurationExtensionContent} from '../app/select-app.js'
import {AppVersion, AppModuleVersion, DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {deepCompareWithOrderInsensitiveArrays} from '@shopify/cli-kit/common/object'

export interface ConfigExtensionIdentifiersBreakdown {
  existingFieldNames: string[]
  existingUpdatedFieldNames: string[]
  newFieldNames: string[]
  deletedFieldNames: string[]
}

export interface ExtensionIdentifierBreakdownInfo {
  title: string
  uid: string | undefined
  experience: 'extension' | 'dashboard'
}

export function buildExtensionBreakdownInfo(title: string, uid: string | undefined): ExtensionIdentifierBreakdownInfo {
  return {title, uid, experience: 'extension'}
}

export function buildDashboardBreakdownInfo(title: string): ExtensionIdentifierBreakdownInfo {
  return {title, uid: undefined, experience: 'dashboard'}
}

export interface ExtensionIdentifiersBreakdown {
  onlyRemote: ExtensionIdentifierBreakdownInfo[]
  toCreate: ExtensionIdentifierBreakdownInfo[]
  toUpdate: ExtensionIdentifierBreakdownInfo[]
  unchanged: ExtensionIdentifierBreakdownInfo[]
}

export async function extensionsIdentifiersReleaseBreakdown(
  developerPlatformClient: DeveloperPlatformClient,
  app: MinimalOrganizationApp,
  version: string,
) {
  const {versionsDiff, versionDetails} = await versionDiffByVersion(app, version, developerPlatformClient)

  const mapIsExtension = (extensions: AppVersionsDiffExtensionSchema[]) =>
    extensions
      .filter(
        (extension) =>
          extension.specification.experience === 'extension' &&
          extension.specification.identifier !== 'webhook_subscription',
      )
      .map((extension) => buildExtensionBreakdownInfo(extension.registrationTitle, undefined))
  const mapIsDashboard = (extensions: AppVersionsDiffExtensionSchema[]) =>
    extensions
      .filter((extension) => extension.specification.options.managementExperience === 'dashboard')
      .map((extension) => buildDashboardBreakdownInfo(extension.registrationTitle))

  const extensionIdentifiersBreakdown = {
    onlyRemote: [...mapIsExtension(versionsDiff.removed), ...mapIsDashboard(versionsDiff.removed)],
    toCreate: [...mapIsExtension(versionsDiff.added), ...mapIsDashboard(versionsDiff.added)],
    toUpdate: [],
    unchanged: [...mapIsExtension(versionsDiff.updated), ...mapIsDashboard(versionsDiff.updated)],
  }

  return {extensionIdentifiersBreakdown, versionDetails}
}

export function configExtensionsIdentifiersReleaseBreakdown({
  localApp,
  versionAppModules,
  activeAppVersion,
}: {
  localApp: AppInterface
  versionAppModules: AppModuleVersion[]
  activeAppVersion?: AppVersion
}) {
  if (localApp.allExtensions.filter((extension) => extension.isAppConfigExtension).length === 0) return
  const versionConfig = remoteAppConfigurationExtensionContent(
    versionAppModules,
    localApp.specifications ?? [],
    localApp.remoteFlags,
  )
  const activeConfig = remoteAppConfigurationExtensionContent(
    activeAppVersion?.appModuleVersions ?? [],
    localApp.specifications ?? [],
    localApp.remoteFlags,
  )
  return buildConfigExtensionIdentifiersBreakdown(versionConfig, activeConfig)
}

export function buildConfigExtensionIdentifiersBreakdown(
  localConfig: {[key: string]: unknown},
  remoteConfig: {[key: string]: unknown},
): ConfigExtensionIdentifiersBreakdown | undefined {
  const fieldNames = new Set([...Object.keys(localConfig), ...Object.keys(remoteConfig)])
  if (fieldNames.size === 0) return undefined

  const breakdown: ConfigExtensionIdentifiersBreakdown = {
    existingFieldNames: [],
    existingUpdatedFieldNames: [],
    newFieldNames: [],
    deletedFieldNames: [],
  }

  for (const fieldName of fieldNames) {
    const localValue = localConfig[fieldName]
    const remoteValue = remoteConfig[fieldName]

    if (localValue === undefined) {
      breakdown.deletedFieldNames.push(fieldName)
    } else if (remoteValue === undefined) {
      breakdown.newFieldNames.push(fieldName)
    } else if (deepCompareWithOrderInsensitiveArrays(localValue, remoteValue)) {
      breakdown.existingFieldNames.push(fieldName)
    } else {
      breakdown.existingUpdatedFieldNames.push(fieldName)
    }
  }

  return breakdown
}
