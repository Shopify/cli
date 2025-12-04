import {appFlags, operationFlags} from '../../flags.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../services/app-context.js'
import {storeContext} from '../../services/store-context.js'
import {executeOperation} from '../../services/execute-operation.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {readStdinString} from '@shopify/cli-kit/node/system'
import {AbortError} from '@shopify/cli-kit/node/error'

export default class Execute extends AppLinkedCommand {
  static summary = 'Execute GraphQL queries and mutations.'

  static description =
    'Executes a GraphQL query or mutation on the specified store, and writes the result to STDOUT or a file.'

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...operationFlags,
  }

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(Execute)

    const query = flags.query ?? (await readStdinString())
    if (!query) {
      throw new AbortError(
        'No query provided. Use the --query flag or pipe input via stdin.',
        'Example: echo "query { shop { name } }" | shopify app execute',
      )
    }

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

    await executeOperation({
      remoteApp: appContextResult.remoteApp,
      storeFqdn: store.shopDomain,
      query,
      variables: flags.variables,
      apiVersion: flags.version,
      outputFile: flags['output-file'],
    })

    return {app: appContextResult.app}
  }
}
