import {encodeStoreExecuteOutputDocument, encodeStoreExecuteResult} from './codec.js'
import {writeFile} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import type {StoreExecuteResult} from './types.js'

type StoreExecuteOutputFormat = 'text' | 'json'

export async function writeOrOutputStoreExecuteResult(
  result: StoreExecuteResult,
  outputFile?: string,
  format: StoreExecuteOutputFormat = 'text',
): Promise<void> {
  if (outputFile) {
    await writeFile(outputFile, encodeStoreExecuteResult(result))
    if (format === 'json') outputResult(encodeStoreExecuteOutputDocument({outputFile, result}))
    else if (result.failure) throw new AbortError(`GraphQL operation returned user errors (${result.failure.code}).`)
    else renderSuccess({headline: 'Operation succeeded.', body: `Results written to ${outputFile}`})
  } else if (format === 'json') {
    outputResult(encodeStoreExecuteResult(result))
  } else if (result.failure) {
    throw new AbortError(`GraphQL operation returned user errors (${result.failure.code}).`)
  } else {
    renderSuccess({headline: 'Operation succeeded.'})
  }

  if (result.failure) throw new AbortError(`GraphQL operation returned user errors (${result.failure.code}).`)
}
