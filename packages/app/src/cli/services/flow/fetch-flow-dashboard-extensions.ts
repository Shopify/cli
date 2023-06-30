import {fetchAppExtensionRegistrations} from '../dev/fetch.js'

export async function getActiveDashboardExtensions({token, apiKey}: {token: string; apiKey: string}) {
  const initialRemoteExtensions = await fetchAppExtensionRegistrations({token, apiKey})
  const {dashboardManagedExtensionRegistrations} = initialRemoteExtensions.app
  return dashboardManagedExtensionRegistrations.filter((ext) => {
    const isFlow = ext.type === 'flow_action_definition' || ext.type === 'flow_trigger_definition'
    const hasActiveVersion = ext.activeVersion && ext.activeVersion.config
    const hasDraftVersion = ext.draftVersion && ext.draftVersion.config
    return isFlow && (hasActiveVersion || hasDraftVersion)
  })
}
