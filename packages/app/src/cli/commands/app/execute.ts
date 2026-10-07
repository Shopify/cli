import {appFlags, operationFlags} from '../../flags.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../utilities/app-linked-command.js'
import {executeOperation} from '../../services/execute-operation.js'
import {appExecuteJsonOutputSchema} from '../../services/execute-operation/types.js'
import {renderExecuteOperationResult} from '../../services/execute-operation/result.js'
import {prepareExecuteContext} from '../../utilities/execute-command-helpers.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class Execute extends AppLinkedCommand {
  static summary = 'Execute GraphQL queries and mutations.'

  static descriptionWithMarkdown = `Executes an Admin API GraphQL query or mutation on the specified store. Mutations are only allowed on dev stores.

  For operations that process large amounts of data, use [\`bulk execute\`](https://shopify.dev/docs/api/shopify-cli/app/app-bulk-execute) instead.`

  static description = this.descriptionForHelp()

  static get jsonOutputSchema() {
    return appExecuteJsonOutputSchema
  }

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...operationFlags,
    ...jsonFlag,
  }

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(Execute)

    const {query, appContextResult, store} = await prepareExecuteContext(flags)

    const result = await executeOperation({
      organization: appContextResult.organization,
      remoteApp: appContextResult.remoteApp,
      store,
      query,
      variables: flags.variables,
      variableFile: flags['variable-file'],
      ...(flags.version && {version: flags.version}),
    })
    await renderExecuteOperationResult(result, flags.json ? 'json' : 'text', flags['output-file'])

    return {app: appContextResult.app}
  }
}
