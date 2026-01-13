import {appFlags, operationFlags} from '../../flags.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../utilities/app-linked-command.js'
import {executeOperation} from '../../services/execute-operation.js'
import {prepareExecuteContext} from '../../utilities/execute-command-helpers.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class Execute extends AppLinkedCommand {
  static summary = 'Execute GraphQL queries and mutations.'

  static hidden = true

  static description = 'Executes an Admin API GraphQL query or mutation on the specified dev store.'

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...operationFlags,
  }

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(Execute)

    const {query, appContextResult, store} = await prepareExecuteContext(flags)

    await executeOperation({
      organization: appContextResult.organization,
      remoteApp: appContextResult.remoteApp,
      store,
      query,
      variables: flags.variables,
      variableFile: flags['variable-file'],
      outputFile: flags['output-file'],
      ...(flags.version && {version: flags.version}),
    })

    return {app: appContextResult.app}
  }
}
