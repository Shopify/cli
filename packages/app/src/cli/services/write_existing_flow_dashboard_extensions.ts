import {fetchAppExtensionRegistrations} from './dev/fetch.js'
import {fetchAppAndIdentifiers} from './context.js'
import {fetchExtension} from './migrate/pull-flow-dashboard-extensions.js'
import {AppInterface} from '../models/app/app.js'

import {FetchExtensionQuerySchema} from '../api/graphql/extension_configurations.js'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

interface DeployOptions {
  /** The app to be built and uploaded */
  app: AppInterface

  /** API key of the app in Partners admin */
  apiKey?: string

  /** If true, ignore any cached appId or extensionId */
  reset: boolean

  /** If true, proceed with deploy without asking for confirmation */
  force: boolean

  /** The deployment label */
  label?: string
}

export async function writeExistingFlowDashboardExtensions(options: DeployOptions) {
  const token = await ensureAuthenticatedPartners()
  const [partnersApp] = await fetchAppAndIdentifiers(options, token)
  const initialRemoteExtensions = await fetchAppExtensionRegistrations({token, apiKey: partnersApp.apiKey})

  const {dashboardManagedExtensionRegistrations} = initialRemoteExtensions.app
  const fetchExtensionPromises: Promise<FetchExtensionQuerySchema>[] = []
  console.log('Fetching extensions', dashboardManagedExtensionRegistrations)
  dashboardManagedExtensionRegistrations.forEach((dashboardManagedExtensionRegistration) => {
    const {uuid, type} = dashboardManagedExtensionRegistration
    const appId = partnersApp.id
    const promise = fetchExtension(uuid, appId, type)
    fetchExtensionPromises.push(promise)
  })
  console.log('Running fetch extension promises')
  const data = await Promise.all(fetchExtensionPromises)
  console.log(data)
}
