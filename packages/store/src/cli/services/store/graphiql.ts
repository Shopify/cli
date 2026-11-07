import {loadStoredStoreSession} from './auth/session-lifecycle.js'
import {TokenProvider} from '@shopify/cli-kit/node/graphiql/server'
import {generateRandomGraphiQLKey, runGraphiQLSession} from '@shopify/cli-kit/node/graphiql/session'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {ensureNoServiceAccountToken} from '@shopify/cli-kit/node/session'

interface OpenStoreGraphiQLOptions {
  store: string
  port?: number
  allowMutations?: boolean
  query?: string
  variables?: string
  apiVersion?: string
  outputFormat?: 'text' | 'json'
  /**
   * Stops the session and closes its server when aborted.
   */
  abortSignal?: AbortSignal
}

/**
 * Spins up a GraphiQL server pointed at `store` using credentials previously stored
 * by `shopify store auth`, prints the URL, opens the browser, and waits for the
 * process to be aborted (Ctrl+C) before shutting down.
 */
export async function openStoreGraphiQL(options: OpenStoreGraphiQLOptions): Promise<void> {
  ensureNoServiceAccountToken()
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
    outputFormat: options.outputFormat,
    additionalReadyMessages: [
      outputContent`Mutations are ${options.allowMutations ? outputToken.green('allowed') : outputToken.yellow('blocked')}.`,
    ],
    abortSignal: options.abortSignal,
  })
}

function createStoredSessionTokenProvider(store: string): TokenProvider {
  return {
    getToken: async (signal) => (await loadStoredStoreSession(store, signal)).accessToken,
    refreshToken: async (signal) => (await loadStoredStoreSession(store, signal)).accessToken,
  }
}
