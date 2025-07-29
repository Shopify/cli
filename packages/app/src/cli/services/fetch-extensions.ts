import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'

export async function getExtensions({
  developerPlatformClient,
  apiKey,
  organizationId,
  extensionTypes,
  onlyDashboardManaged = false,
}: {
  developerPlatformClient: DeveloperPlatformClient
  apiKey: string
  organizationId: string
  extensionTypes: string[]
  onlyDashboardManaged?: boolean
}) {
  const initialRemoteExtensions = await developerPlatformClient.appExtensionRegistrations({
    id: apiKey,
    apiKey,
    organizationId,
  })
  const {dashboardManagedExtensionRegistrations, extensionRegistrations} = initialRemoteExtensions.app

  const extensionsToFilter = onlyDashboardManaged
    ? dashboardManagedExtensionRegistrations
    : extensionRegistrations.concat(dashboardManagedExtensionRegistrations)

  return extensionsToFilter.filter((ext) => {
    const isNeededExtensionType = extensionTypes.includes(ext.type.toLowerCase())
    const hasActiveVersion = ext.activeVersion && ext.activeVersion.config
    const hasDraftVersion = ext.draftVersion && ext.draftVersion.config
    return isNeededExtensionType && (hasActiveVersion ?? hasDraftVersion)
  })
}
