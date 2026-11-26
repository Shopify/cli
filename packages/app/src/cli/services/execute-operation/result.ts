import {appExecuteJsonOutputSchema, AppExecuteResult, ExecuteOperationResult} from './types.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {writeFile} from '@shopify/cli-kit/node/fs'
import {outputResult} from '@shopify/cli-kit/node/output'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {renderError, renderSuccess} from '@shopify/cli-kit/node/ui'

export async function renderExecuteOperationResult(
  result: ExecuteOperationResult,
  format: 'json' | 'text',
  outputFile?: string,
): Promise<void> {
  if (result.status === 'failed') {
    if (format === 'json') {
      const error = new AbortError('GraphQL operation failed.')
      error.details = result.details
      throw error
    }
    renderError({
      headline: 'GraphQL operation failed.',
      body: JSON.stringify({errors: result.details.errors}, null, 2),
    })
    return
  }

  const resultString =
    format === 'json' ? encodeNativeGraphQLResult(result.result) : JSON.stringify(result.result.data, null, 2)
  if (outputFile) {
    await writeFile(outputFile, resultString)
    if (format === 'json') {
      outputResult(appExecuteJsonOutputSchema.encode({path: resolvePath(outputFile), format: 'json'}))
    } else {
      renderSuccess({headline: 'Operation succeeded.', body: `Results written to ${outputFile}`})
    }
  } else if (format === 'json') {
    outputResult(resultString)
  } else {
    renderSuccess({headline: 'Operation succeeded.'})
    outputResult(resultString)
  }
}

// Zod drops "__proto__" keys when it parses, and GraphQL aliases and extensions can use that key,
// so the result is validated against the contract and then encoded as received.
function encodeNativeGraphQLResult(result: AppExecuteResult): string {
  appExecuteJsonOutputSchema.validate(result)
  return JSON.stringify(result, null, 2)
}
