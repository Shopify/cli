import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'

export async function getActiveDashboardExtensions({
  developerPlatformClient,
  apiKey,
  organizationId,
  extTypes,
}: {
  developerPlatformClient: DeveloperPlatformClient
  apiKey: string
  organizationId: string
  extTypes: string[]
}) {
  const initialRemoteExtensions = await developerPlatformClient.appExtensionRegistrations({
    id: apiKey,
    apiKey,
    organizationId,
  })
  const {dashboardManagedExtensionRegistrations} = initialRemoteExtensions.app
  return dashboardManagedExtensionRegistrations.filter((ext) => {
    const isNeededExtType = extTypes.includes(ext.type)
    const hasActiveVersion = ext.activeVersion && ext.activeVersion.config
    const hasDraftVersion = ext.draftVersion && ext.draftVersion.config
    return isNeededExtType && (hasActiveVersion || hasDraftVersion)
  })
}
