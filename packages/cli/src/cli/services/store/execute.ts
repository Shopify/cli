import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import {outputContent} from '@shopify/cli-kit/node/output'
import {prepareStoreExecuteRequest} from './execute-request.js'
import {getStoreGraphQLTarget, StoreGraphQLApi} from './graphql-targets.js'

interface ExecuteStoreOperationInput {
  store: string
  api?: StoreGraphQLApi
  query?: string
  queryFile?: string
  variables?: string
  variableFile?: string
  version?: string
  allowMutations?: boolean
}

export async function executeStoreOperation(input: ExecuteStoreOperationInput): Promise<unknown> {
  const target = getStoreGraphQLTarget(input.api ?? 'admin')

  const request = await prepareStoreExecuteRequest({
    query: input.query,
    queryFile: input.queryFile,
    variables: input.variables,
    variableFile: input.variableFile,
    version: input.version,
    allowMutations: input.allowMutations,
  })

  const context = await renderSingleTask({
    title: outputContent`Loading stored store auth`,
    task: async () => target.prepareContext({store: input.store, requestedVersion: request.requestedVersion}),
    renderOptions: {stdout: process.stderr},
  })

  return await target.execute({
    store: input.store,
    context,
    request,
  })
}
