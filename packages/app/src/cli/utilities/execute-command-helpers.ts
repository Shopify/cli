import {linkedAppContext, LoadedAppContextOutput} from '../services/app-context.js'
import {storeContext} from '../services/store-context.js'
import {validateSingleOperation} from '../services/graphql/common.js'
import {OrganizationStore} from '../models/organization.js'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {readFile, fileExists} from '@shopify/cli-kit/node/fs'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

interface AppStoreContextFlags {
  path: string
  'client-id'?: string
  reset: boolean
  config?: string
  store?: string
}

interface AppStoreContext {
  appContextResult: LoadedAppContextOutput
  store: OrganizationStore
}

interface ExecuteCommandFlags extends AppStoreContextFlags {
  query?: string
  'query-file'?: string
}

interface ExecuteContext extends AppStoreContext {
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
    storeTypes: ['APP_DEVELOPMENT', 'DEVELOPMENT', 'DEVELOPMENT_SUPERSET', 'PRODUCTION'],
  })

  return {appContextResult, store}
}

/**
 * Prepares the execution context for GraphQL operations.
 * Handles query input from flag or file, validates GraphQL syntax, and sets up app and store contexts.
 *
 * @param flags - Command flags containing configuration options.
 * @returns Context object containing query, app context, and store information.
 */
export async function prepareExecuteContext(flags: ExecuteCommandFlags): Promise<ExecuteContext> {
  let query: string | undefined

  if (flags.query) {
    query = flags.query
  } else if (flags['query-file']) {
    const queryFile = flags['query-file']
    if (!(await fileExists(queryFile))) {
      throw new AbortError(
        outputContent`Query file not found at ${outputToken.path(queryFile)}. Please check the path and try again.`,
      )
    }
    query = await readFile(queryFile, {encoding: 'utf8'})
  }

  if (!query) {
    throw new BugError(
      'Query should have been provided via --query or --query-file flags due to exactlyOne constraint. This indicates the oclif flag validation failed.',
    )
  }

  // Validate GraphQL syntax and ensure single operation
  validateSingleOperation(query)

  const {appContextResult, store} = await prepareAppStoreContext(flags)

  return {query, appContextResult, store}
}
