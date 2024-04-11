import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'

export async function getExtensions({
  developerPlatformClient,
  apiKey,
  organizationId,
  extensionTypes,
}: {
  developerPlatformClient: DeveloperPlatformClient
  apiKey: string
  organizationId: string
  extensionTypes: string[]
}) {
  const initialRemoteExtensions = await developerPlatformClient.appExtensionRegistrations({
    id: apiKey,
    apiKey,
    organizationId,
  })
  const {dashboardManagedExtensionRegistrations, extensionRegistrations} = initialRemoteExtensions.app
  return extensionRegistrations.concat(dashboardManagedExtensionRegistrations).filter((ext) => {
    const isNeededExtensionType = extensionTypes.includes(ext.type.toLowerCase())
    const hasActiveVersion = ext.activeVersion && ext.activeVersion.config
    const hasDraftVersion = ext.draftVersion && ext.draftVersion.config
    return isNeededExtensionType && (hasActiveVersion || hasDraftVersion)
  })
}
