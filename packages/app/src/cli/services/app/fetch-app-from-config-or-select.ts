import {selectApp} from './select-app.js'
import {AppConfigurationInterface, isCurrentAppSchema} from '../../models/app/app.js'
import {InvalidApiKeyErrorMessage} from '../context.js'
import {OrganizationApp} from '../../models/organization.js'
import {selectDeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AbortError} from '@shopify/cli-kit/node/error'

export async function fetchAppFromConfigOrSelect(
  app: AppConfigurationInterface,
  developerPlatformClient = selectDeveloperPlatformClient(),
): Promise<OrganizationApp> {
  let organizationApp
  if (isCurrentAppSchema(app.configuration)) {
    const apiKey = app.configuration.client_id
    organizationApp = await developerPlatformClient.appFromId({
      id: apiKey,
      apiKey,
      organizationId: app.configuration.organization_id ?? '0',
    })
    if (!organizationApp) {
      const errorMessage = InvalidApiKeyErrorMessage(apiKey)
      throw new AbortError(errorMessage.message, errorMessage.tryMessage)
    }
  } else {
    organizationApp = await selectApp()
  }
  return organizationApp
}
