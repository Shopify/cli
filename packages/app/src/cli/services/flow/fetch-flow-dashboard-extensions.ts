import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'

export async function getActiveDashboardExtensions({
  developerPlatformClient,
  apiKey,
  organizationId,
}: {
  developerPlatformClient: DeveloperPlatformClient
  apiKey: string
  organizationId: string
}) {
  const initialRemoteExtensions = await developerPlatformClient.appExtensionRegistrations({
    id: apiKey,
    apiKey,
    organizationId,
  })
  const {dashboardManagedExtensionRegistrations} = initialRemoteExtensions.app
  return dashboardManagedExtensionRegistrations.filter((ext) => {
    const isFlow = ext.type === 'flow_action_definition' || ext.type === 'flow_trigger_definition'
    const hasActiveVersion = ext.activeVersion && ext.activeVersion.config
    const hasDraftVersion = ext.draftVersion && ext.draftVersion.config
    return isFlow && (hasActiveVersion || hasDraftVersion)
  })
}
