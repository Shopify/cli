import {appFlags, bulkOperationFlags} from '../../../flags.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {executeBulkOperation, prepareBulkOperation} from '../../../services/bulk-operations/execute-bulk-operation.js'
import {executeBulkOperationJsonOutputSchema} from '../../../services/bulk-operations/types.js'
import {renderExecuteBulkOperationResult} from '../../../services/bulk-operations/execute-result.js'
import {logBulkOperationStart} from '../../../services/bulk-operations/progress.js'
import {prepareExecuteContext} from '../../../utilities/execute-command-helpers.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class BulkExecute extends AppLinkedCommand {
  static summary = 'Execute bulk operations.'

  static descriptionWithMarkdown = `Executes an Admin API GraphQL query or mutation on the specified store, as a bulk operation. Mutations are only allowed on dev stores.

  Bulk operations allow you to process large amounts of data asynchronously. Learn more about [bulk query operations](https://shopify.dev/docs/api/usage/bulk-operations/queries) and [bulk mutation operations](https://shopify.dev/docs/api/usage/bulk-operations/imports).

  Use [\`bulk status\`](https://shopify.dev/docs/api/shopify-cli/app/app-bulk-status) to check the status of your bulk operations.

  With \`--watch\`, completed results are written as JSONL to stdout or \`--output-file\`. With \`--json\`, stdout contains one result object with operation details and downloaded JSONL in \`resultsJsonl\`. With \`--json --output-file\`, stdout contains only an absolute file receipt with \`path\` and \`format\`.`

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    ...appFlags,
    ...bulkOperationFlags,
  }

  static get jsonOutputSchema() {
    return executeBulkOperationJsonOutputSchema
  }

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(BulkExecute)

    const {query, appContextResult, store} = await prepareExecuteContext(flags)

    const format = flags.json ? 'json' : 'text'
    const input = await prepareBulkOperation({
      remoteApp: appContextResult.remoteApp,
      store,
      query,
      variables: flags.variables,
      variableFile: flags['variable-file'],
      watch: flags.watch ?? false,
      ...(flags.version && {version: flags.version}),
    })
    logBulkOperationStart(
      'Starting bulk operation.',
      {
        organization: appContextResult.organization,
        remoteApp: appContextResult.remoteApp,
        storeFqdn: store.shopDomain,
        version: input.version,
      },
      format,
    )
    const result = await executeBulkOperation(input)
    await renderExecuteBulkOperationResult(result, {
      format,
      watch: flags.watch ?? false,
      outputFile: flags['output-file'],
    })

    return {app: appContextResult.app}
  }
}
