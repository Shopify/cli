import {loadStoredStoreSession} from '../auth/session-lifecycle.js'
import {setupGraphiQLServer, TokenProvider} from '@shopify/cli-kit/node/graphiql/server'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {openURL} from '@shopify/cli-kit/node/system'
import {outputContent, outputInfo, outputToken, outputWarn} from '@shopify/cli-kit/node/output'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import {randomBytes} from 'crypto'

interface OpenStoreGraphiQLOptions {
  store: string
  port?: number
  open?: boolean
  allowMutations?: boolean
  query?: string
  variables?: string
  apiVersion?: string
  /**
   * Test-only seam: aborts the server-running loop without requiring a real SIGINT.
   * In production, the command itself listens for SIGINT and exits.
   */
  abortSignal?: AbortSignal
}

/**
 * Spins up a GraphiQL server pointed at `store` using credentials previously stored
 * by `shopify store auth`, prints the URL, optionally opens the browser, and waits
 * for the process to be aborted (Ctrl+C) before shutting down.
 */
export async function openStoreGraphiQL(options: OpenStoreGraphiQLOptions): Promise<void> {
  const tokenProvider = createStoredSessionTokenProvider(options.store)

  // Generate the GraphiQL key here (instead of letting the server generate one internally)
  // so we can include it in the URL we print and open. The server requires `?key=...` on
  // every request and rejects mismatches with HTTP 404.
  const key = randomBytes(32).toString('hex')

  const port = await getAvailableTCPPort(options.port)
  const server = setupGraphiQLServer({
    stdout: process.stdout,
    port,
    storeFqdn: options.store,
    tokenProvider,
    key,
    protectMutations: !options.allowMutations,
  })

  const url = buildGraphiQLUrl({
    port,
    key,
    query: options.query,
    variables: options.variables,
    apiVersion: options.apiVersion,
  })

  outputInfo(outputContent`GraphiQL is running at ${outputToken.link(url)}`)
  outputInfo(outputContent`Mutations are ${options.allowMutations ? outputToken.green('allowed') : outputToken.yellow('blocked')}.`)
  outputInfo('Press Ctrl+C to stop.')

  if (options.open !== false) {
    const opened = await openURL(url)
    if (!opened) {
      outputWarn('Browser did not open automatically. Open the URL above manually.')
    }
  }

  await waitForAbort(options.abortSignal)
  server.close()
}

function createStoredSessionTokenProvider(store: string): TokenProvider {
  return {
    getToken: async () => (await loadStoredStoreSession(store)).accessToken,
    refreshToken: async () => (await loadStoredStoreSession(store)).accessToken,
  }
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

/**
 * Resolves when the abort signal fires, or when the process receives SIGINT.
 * Used to keep the server alive until the user explicitly stops the command.
 */
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
