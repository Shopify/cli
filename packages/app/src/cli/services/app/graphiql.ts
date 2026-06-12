import {createClientCredentialsTokenProvider} from '../dev/processes/graphiql-token-provider.js'
import {OrganizationApp} from '../../models/organization.js'
import {buildAppURLForAdmin} from '../../utilities/app/app-url.js'
import {resolveGraphiQLKey, setupGraphiQLServer} from '@shopify/cli-kit/node/graphiql/server'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {openURL} from '@shopify/cli-kit/node/system'
import {outputContent, outputInfo, outputToken, outputWarn} from '@shopify/cli-kit/node/output'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
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
  const apiSecret = options.remoteApp.apiSecretKeys[0]?.secret ?? ''
  const key = resolveGraphiQLKey(undefined, apiSecret, options.store)
  const port = await getAvailableTCPPort(options.port)
  const tokenProvider = createClientCredentialsTokenProvider({
    apiKey: options.remoteApp.apiKey,
    apiSecret,
    storeFqdn: options.store,
  })

  const adminDomain = await adminFqdn()
  const appUrl = buildAppURLForAdmin(options.store, options.remoteApp.apiKey, adminDomain)
  const server = setupGraphiQLServer({
    stdout: process.stdout,
    port,
    storeFqdn: options.store,
    tokenProvider,
    key,
    appContext: {
      appName: options.remoteApp.title,
      appUrl,
      apiSecret,
    },
  })

  const url = buildGraphiQLUrl({
    port,
    key,
    query: undefined,
    variables: options.variables,
    apiVersion: options.apiVersion,
  })

  outputInfo(outputContent`GraphiQL is running at ${outputToken.link(url)}`)
  outputInfo('Press Ctrl+C to stop.')

  const opened = await openURL(url)
  if (!opened) {
    outputWarn('Browser did not open automatically. Open the URL above manually.')
  }

  await waitForAbort(options.abortSignal)
  server.close()
}

function buildGraphiQLUrl(options: {
  port: number
  key: string
  query?: string
  variables?: string
  apiVersion?: string
}): string {
  const url = new URL(`http://localhost:${options.port}/graphiql`)
  url.searchParams.set('key', options.key)
  if (options.query) url.searchParams.set('query', options.query)
  if (options.variables) url.searchParams.set('variables', options.variables)
  if (options.apiVersion) url.searchParams.set('api_version', options.apiVersion)
  return url.toString()
}

async function waitForAbort(externalSignal?: AbortSignal): Promise<void> {
  const controller = new AbortController()

  const onSigint = () => controller.abort()
  process.once('SIGINT', onSigint)

  try {
    await new Promise<void>((resolve) => {
      if (controller.signal.aborted) {
        resolve()
        return
      }
      controller.signal.addEventListener('abort', () => resolve(), {once: true})
      externalSignal?.addEventListener('abort', () => controller.abort(), {once: true})
    })
  } finally {
    process.removeListener('SIGINT', onSigint)
  }
}
