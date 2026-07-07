import {LoadedAppContextOutput} from './app-context.js'
import {OrganizationStore} from '../models/organization.js'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'

interface DevCleanOptions {
  appContextResult: LoadedAppContextOutput
  store: OrganizationStore
}

export async function devClean(options: DevCleanOptions) {
  const client = options.appContextResult.developerPlatformClient
  const remoteApp = options.appContextResult.remoteApp

  const result = await client.devSessionDelete({shopFqdn: options.store.shopDomain, appId: remoteApp.id})

  if (result.devSessionDelete?.userErrors.length) {
    const errors = result.devSessionDelete.userErrors.map((error) => error.message).join('\n')
    throw new AbortError(`Failed to stop the dev preview: ${errors}`)
  }

  renderSuccess({
    headline: 'Dev preview stopped.',
    body: [
      `The dev preview has been stopped on ${options.store.shopDomain} and the app's active version has been restored.`,
      'You can start it again with',
      {command: 'shopify app dev'},
    ],
  })
}
