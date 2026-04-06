import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import {outputContent} from '@shopify/cli-kit/node/output'
import {prepareStoreExecuteRequest} from './request.js'
import {writeOrOutputStoreExecuteResult} from './result.js'
import {getStoreGraphQLTarget, type StoreGraphQLApi} from './targets.js'

interface ExecuteStoreOperationInput {
  store: string
  api?: StoreGraphQLApi
  query?: string
  queryFile?: string
  variables?: string
  variableFile?: string
  outputFile?: string
  version?: string
  allowMutations?: boolean
}

export async function executeStoreOperation(input: ExecuteStoreOperationInput): Promise<void> {
  const target = getStoreGraphQLTarget(input.api ?? 'admin')

  const request = await prepareStoreExecuteRequest({
    query: input.query,
    queryFile: input.queryFile,
    variables: input.variables,
    variableFile: input.variableFile,
    outputFile: input.outputFile,
    version: input.version,
    allowMutations: input.allowMutations,
  })

  const context = await renderSingleTask({
    title: outputContent`Loading stored store auth`,
    task: async () => target.prepareContext({store: input.store, requestedVersion: request.requestedVersion}),
    renderOptions: {stdout: process.stderr},
  })

  const result = await target.execute({context, request})

  await writeOrOutputStoreExecuteResult(result, request.outputFile)
}
