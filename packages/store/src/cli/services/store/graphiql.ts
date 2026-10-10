import {loadStoredStoreSession} from './auth/session-lifecycle.js'
import {TokenProvider} from '@shopify/cli-kit/node/graphiql/server'
import {generateRandomGraphiQLKey, runGraphiQLSession} from '@shopify/cli-kit/node/graphiql/session'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {ensureNoOrganizationAutomationToken} from '@shopify/cli-kit/node/session'

interface OpenStoreGraphiQLOptions {
  store: string
  port?: number
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
 * by `shopify store auth`, prints the URL, opens the browser, and waits for the
 * process to be aborted (Ctrl+C) before shutting down.
 */
export async function openStoreGraphiQL(options: OpenStoreGraphiQLOptions): Promise<void> {
  ensureNoOrganizationAutomationToken()
  const tokenProvider = createStoredSessionTokenProvider(options.store)

  const key = generateRandomGraphiQLKey()

  await runGraphiQLSession({
    port: options.port,
    storeFqdn: options.store,
    tokenProvider,
    key,
    protectMutations: !options.allowMutations,
    query: options.query,
    variables: options.variables,
    apiVersion: options.apiVersion,
    additionalReadyMessages: [
      outputContent`Mutations are ${options.allowMutations ? outputToken.green('allowed') : outputToken.yellow('blocked')}.`,
    ],
    abortSignal: options.abortSignal,
  })
}

function createStoredSessionTokenProvider(store: string): TokenProvider {
  return {
    getToken: async () => (await loadStoredStoreSession(store)).accessToken,
    refreshToken: async () => (await loadStoredStoreSession(store)).accessToken,
  }
}
