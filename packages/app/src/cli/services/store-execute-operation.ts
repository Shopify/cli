import {resolveApiVersion} from './graphql/common.js'
import {runGraphQLExecution} from './execute-operation.js'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {outputContent} from '@shopify/cli-kit/node/output'

interface StoreExecuteOperationInput {
  storeFqdn: string
  query: string
  variables?: string
  variableFile?: string
  outputFile?: string
  version?: string
}

export async function storeExecuteOperation(input: StoreExecuteOperationInput): Promise<void> {
  const {storeFqdn, query, variables, variableFile, outputFile, version: userSpecifiedVersion} = input

  const adminSession = await ensureAuthenticatedAdmin(storeFqdn)

  const version = await renderSingleTask({
    title: outputContent`Resolving API version`,
    task: async (): Promise<string> => {
      return resolveApiVersion({adminSession, userSpecifiedVersion})
    },
    renderOptions: {stdout: process.stderr},
  })

  await runGraphQLExecution({adminSession, query, variables, variableFile, outputFile, version})
}
