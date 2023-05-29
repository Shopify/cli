import {fetchAppExtensionRegistrations} from './dev/fetch.js'
import {fetchAppAndIdentifiers} from './context.js'
import {AppInterface} from '../models/app/app.js'

import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

interface DeployOptions {
  /** The app to be built and uploaded */
  app: AppInterface

  /** API key of the app in Partners admin */
  apiKey?: string
}

export async function getActiveDashboardExtensions(options: DeployOptions) {
  const token = await ensureAuthenticatedPartners()
  const [partnersApp] = await fetchAppAndIdentifiers({app: options.app, apiKey: options.apiKey, reset: false}, token)
  const initialRemoteExtensions = await fetchAppExtensionRegistrations({token, apiKey: partnersApp.apiKey})

  const {dashboardManagedExtensionRegistrations} = initialRemoteExtensions.app
  return dashboardManagedExtensionRegistrations.map((extension) => {
    if (extension && extension.activeVersion && extension.activeVersion.config) {
      return extension
    }
  })
}
