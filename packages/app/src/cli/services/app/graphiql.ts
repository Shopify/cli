import {createClientCredentialsTokenProvider} from '../dev/processes/graphiql-token-provider.js'
import {OrganizationApp} from '../../models/organization.js'
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
  outputFormat?: 'text' | 'json'
  /**
   * Stops the session and closes its server when aborted.
   */
  abortSignal?: AbortSignal
}

export async function openAppGraphiQL(options: OpenAppGraphiQLOptions): Promise<void> {
  const apiSecret = options.remoteApp.apiSecretKeys[0]?.secret ?? ''
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
    outputFormat: options.outputFormat,
    abortSignal: options.abortSignal,
  })
}
