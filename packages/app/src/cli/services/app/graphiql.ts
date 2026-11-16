import {createClientCredentialsTokenProvider} from '../dev/processes/graphiql-token-provider.js'
import {OrganizationApp, appClientSecret} from '../../models/organization.js'
import {buildAppURLForAdmin} from '../../utilities/app/app-url.js'
import {resolveGraphiQLKey} from '@shopify/cli-kit/node/graphiql/server'
import {runGraphiQLSession} from '@shopify/cli-kit/node/graphiql/session'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {adminFqdn} from '@shopify/cli-kit/node/context/fqdn'

interface OpenAppGraphiQLOptions {
  remoteApp: OrganizationApp
  store: string
  port?: number
  variables?: string
  apiVersion?: string
  /**
   * Test-only seam: aborts the server-running loop without requiring a real SIGINT.
   * In production, the command itself listens for SIGINT and exits.
   */
  abortSignal?: AbortSignal
}

export async function openAppGraphiQL(options: OpenAppGraphiQLOptions): Promise<void> {
  const apiSecret = await appClientSecret(options.remoteApp)
  const key = resolveGraphiQLKey(undefined, apiSecret, options.store)
  const tokenProvider = createClientCredentialsTokenProvider({
    apiKey: options.remoteApp.apiKey,
    apiSecret,
    storeFqdn: options.store,
  })

  const adminDomain = await adminFqdn()
  const appUrl = buildAppURLForAdmin(options.store, options.remoteApp.apiKey, adminDomain)

  await runGraphiQLSession({
    port: options.port,
    storeFqdn: options.store,
    tokenProvider,
    key,
    appContext: {
      appName: options.remoteApp.title,
      appUrl,
      apiSecret,
    },
    variables: options.variables,
    apiVersion: options.apiVersion,
    abortSignal: options.abortSignal,
  })
}
