import {prepareStoreExecuteRequest} from './request.js'
import {getStoreGraphQLTarget, type StoreGraphQLApi} from './targets.js'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import {outputContent} from '@shopify/cli-kit/node/output'

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

  return target.execute({context, request})
}
