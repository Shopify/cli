import {selectApp} from './select-app.js'
import {AppConfigurationInterface, isCurrentAppSchema} from '../../models/app/app.js'
import {fetchAppDetailsFromApiKey} from '../dev/fetch.js'
import {InvalidApiKeyErrorMessage} from '../context.js'
import {OrganizationApp} from '../../models/organization.js'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'

export async function fetchAppFromConfigOrSelect(app: AppConfigurationInterface): Promise<OrganizationApp> {
  let organizationApp
  if (isCurrentAppSchema(app.configuration)) {
    const token = await ensureAuthenticatedPartners()
    const apiKey = app.configuration.client_id
    organizationApp = await fetchAppDetailsFromApiKey(apiKey, token)
    if (!organizationApp) {
      const errorMessage = InvalidApiKeyErrorMessage(apiKey)
      throw new AbortError(errorMessage.message, errorMessage.tryMessage)
    }
  } else {
    organizationApp = await selectApp()
  }
  return organizationApp
}
