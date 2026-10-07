import {LoadedAppContextOutput} from './app-context.js'
import {AppDevCleanResult} from './dev-clean/types.js'
import {OrganizationStore} from '../models/organization.js'
import {AbortError} from '@shopify/cli-kit/node/error'

interface DevCleanOptions {
  appContextResult: LoadedAppContextOutput
  store: OrganizationStore
}

export async function devClean(options: DevCleanOptions): Promise<AppDevCleanResult> {
  const client = options.appContextResult.developerPlatformClient
  const remoteApp = options.appContextResult.remoteApp

  const result = await client.devSessionDelete({shopFqdn: options.store.shopDomain, appId: remoteApp.id})

  const userErrors = result?.devSessionDelete?.userErrors
  if (!Array.isArray(userErrors) || userErrors.some((error) => typeof error?.message !== 'string')) {
    const error = new AbortError('Failed to stop the dev preview: the server returned an invalid response.')
    error.details = {data: result}
    throw error
  }

  if (userErrors.length) {
    const errors = userErrors.map((error) => error.message).join('\n')
    const error = new AbortError(`Failed to stop the dev preview: ${errors}`)
    error.details = {userErrors}
    throw error
  }

  return {
    status: 'success',
    app: {name: remoteApp.title, clientId: remoteApp.apiKey},
    storeDomain: options.store.shopDomain,
  }
}
