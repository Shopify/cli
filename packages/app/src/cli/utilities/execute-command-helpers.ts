import {linkedAppContext, LoadedAppContextOutput} from '../services/app-context.js'
import {storeContext} from '../services/store-context.js'
import {OrganizationStore} from '../models/organization.js'
import {readStdinString} from '@shopify/cli-kit/node/system'
import {AbortError} from '@shopify/cli-kit/node/error'

export interface AppStoreContextFlags {
  path: string
  'client-id'?: string
  reset: boolean
  config?: string
  store?: string
}

export interface AppStoreContext {
  appContextResult: LoadedAppContextOutput
  store: OrganizationStore
}

export interface ExecuteCommandFlags extends AppStoreContextFlags {
  query?: string
}

export interface ExecuteContext extends AppStoreContext {
  query: string
}

/**
 * Prepares the app and store context for commands.
 * Sets up app linking and store selection without query handling.
 *
 * @param flags - Command flags containing configuration options.
 * @returns Context object containing app context and store information.
 */
export async function prepareAppStoreContext(flags: AppStoreContextFlags): Promise<AppStoreContext> {
  const appContextResult = await linkedAppContext({
    directory: flags.path,
    clientId: flags['client-id'],
    forceRelink: flags.reset,
    userProvidedConfigName: flags.config,
  })

  const store = await storeContext({
    appContextResult,
    storeFqdn: flags.store,
    forceReselectStore: flags.reset,
  })

  return {appContextResult, store}
}

/**
 * Prepares the execution context for GraphQL operations.
 * Handles query input from flag or stdin, and sets up app and store contexts.
 *
 * @param flags - Command flags containing configuration options.
 * @param commandName - Name of the command for error messages (e.g., 'execute', 'bulk execute').
 * @returns Context object containing query, app context, and store information.
 */
export async function prepareExecuteContext(
  flags: ExecuteCommandFlags,
  commandName = 'execute',
): Promise<ExecuteContext> {
  const query = flags.query ?? (await readStdinString())
  if (!query) {
    throw new AbortError(
      'No query provided. Use the --query flag or pipe input via stdin.',
      `Example: echo "query { shop { name } }" | shopify app ${commandName}`,
    )
  }

  const {appContextResult, store} = await prepareAppStoreContext(flags)

  return {query, appContextResult, store}
}
