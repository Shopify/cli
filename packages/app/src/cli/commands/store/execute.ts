import {storeOperationFlags} from '../../flags.js'
import {storeExecuteOperation} from '../../services/store-execute-operation.js'
import {loadQuery} from '../../utilities/execute-command-helpers.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import BaseCommand from '@shopify/cli-kit/node/base-command'

export default class StoreExecute extends BaseCommand {
  static summary = 'Execute GraphQL queries and mutations against a store.'

  static descriptionWithMarkdown = `Executes an Admin API GraphQL query or mutation on the specified store, authenticated as the current user.

  Unlike [\`app execute\`](https://shopify.dev/docs/api/shopify-cli/app/app-execute), this command does not require an app to be linked or installed on the target store.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...storeOperationFlags,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreExecute)
    const query = await loadQuery(flags)
    await storeExecuteOperation({
      storeFqdn: flags.store,
      query,
      variables: flags.variables,
      variableFile: flags['variable-file'],
      outputFile: flags['output-file'],
      ...(flags.version && {version: flags.version}),
    })
  }
}
