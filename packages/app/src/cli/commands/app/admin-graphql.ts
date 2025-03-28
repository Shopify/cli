import AppCommand, {AppCommandOutput} from '../../utilities/app-command.js'
import {appFlags} from '../../flags.js'
import {linkedAppContext} from '../../services/app-context.js'
import {storeContext} from '../../services/store-context.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {ensureAuthenticatedAdminAsApp} from '@shopify/cli-kit/node/session'
import {adminAsAppRequest} from '@shopify/cli-kit/node/api/admin-as-app'
import {outputContent, outputInfo, outputToken} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'

export default class AdminGraphql extends AppCommand {
  static hidden = true

  static summary = 'Run a GraphQL query through the Admin API against your development store.'

  static descriptionWithMarkdown = `
  Runs a GraphQL query through the Admin API on behalf of your app, against your development store.

  Query and variables can be provided in two ways:
  1. Using --query and --variables flags
  2. Piping JSON to stdin in the format: {"query": "...", "variables": {...}}

  If using the flags, the --variables flag should be a valid JSON string.

  The same scopes defined in your app's configuration file are used by this command.
  `

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...jsonFlag,
    'api-version': Flags.string({
      description: 'API version to use for the Admin API query',
      default: '2025-04',
      env: 'SHOPIFY_FLAG_ADMIN_API_VERSION',
    }),
    query: Flags.string({
      description: 'GraphQL query to execute',
      env: 'SHOPIFY_FLAG_ADMIN_GRAPHQL_QUERY',
    }),
    variables: Flags.string({
      description: 'Variables for the GraphQL query (as JSON string)',
      env: 'SHOPIFY_FLAG_ADMIN_GRAPHQL_VARIABLES',
      default: '{}',
    }),
  }

  /**
   * Reads data from stdin and parses it as JSON for query and variables
   */
  async readFromStdin(): Promise<{query: string; variables: {[key: string]: unknown}}> {
    // Check if stdin is connected to a terminal (TTY)
    if (process.stdin.isTTY) {
      throw new AbortError(
        'No query provided. You must either:\n' +
          '1. Provide --query and --variables flags, or\n' +
          '2. Pipe in JSON in the format: {"query": "...", "variables": {...}}\n\n' +
          'Example: echo \'{"query": "query { shop { name } }", "variables": {}}\' | ' +
          'shopify app admin-graphql',
      )
    }

    return new Promise((resolve, reject) => {
      let data = ''

      process.stdin.on('data', (chunk) => {
        data += chunk as unknown as string
      })

      process.stdin.on('end', () => {
        try {
          if (!data.trim()) {
            reject(new Error('No input received from stdin'))
            return
          }

          const parsed = JSON.parse(data)

          if (!parsed.query || typeof parsed.query !== 'string') {
            reject(new Error('Input must contain a "query" property that is a string'))
            return
          }

          resolve({
            query: parsed.query,
            variables: parsed.variables || {},
          })
          // eslint-disable-next-line no-catch-all/no-catch-all
        } catch (error) {
          reject(new Error(`Failed to parse stdin as JSON: ${error}`))
        }
      })

      process.stdin.on('error', (error) => {
        reject(new Error(`Error reading from stdin: ${error}`))
      })
    })
  }

  /**
   * Gets query and variables from either flags or stdin
   */
  async getQueryAndVariables(flags: {
    query?: string
    variables?: string
  }): Promise<{query: string; variables: {[key: string]: unknown}}> {
    // If query flag is provided, we use flags for input
    if (flags.query) {
      let variables: {[key: string]: unknown} = {}

      // Parse variables from JSON string
      try {
        variables = JSON.parse(flags.variables as unknown as string)
      } catch (error) {
        throw new AbortError('Failed to parse variables as JSON. Please provide a valid JSON string for --variables')
      }

      return {
        query: flags.query,
        variables,
      }
    }

    // Otherwise, read from stdin
    return this.readFromStdin()
  }

  async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(AdminGraphql)

    const appContextResult = await linkedAppContext({
      directory: flags.path,
      clientId: undefined,
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })
    const store = await storeContext({
      appContextResult,
      storeFqdn: undefined,
      forceReselectStore: flags.reset,
    })

    const session = await ensureAuthenticatedAdminAsApp(
      store.shopDomain,
      appContextResult.remoteApp.apiKey,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      appContextResult.remoteApp.apiSecretKeys[0]!.secret,
    )

    const {query, variables} = await this.getQueryAndVariables(flags)

    try {
      const result = await adminAsAppRequest(query, session, flags['api-version'], variables)

      outputInfo(outputContent`${outputToken.json(result)}`)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      outputInfo(outputContent`${outputToken.json(error)}`)
    }
    return {app: appContextResult.app}
  }
}
