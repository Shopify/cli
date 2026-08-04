import {encodeStoreExecuteOutputDocument, encodeStoreExecuteResult} from './codec.js'
import {writeFile} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputInfo, outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import type {StoreExecuteResult} from './types.js'

type StoreExecuteOutputFormat = 'text' | 'json'

export async function writeOrOutputStoreExecuteResult(
  result: StoreExecuteResult,
  outputFile?: string,
  format: StoreExecuteOutputFormat = 'text',
): Promise<void> {
  const payload = encodeStoreExecuteResult(result)
  const succeeded = !result.failure

  if (outputFile) {
    await writeFile(outputFile, payload)

    if (format === 'json') {
      outputResult(encodeStoreExecuteOutputDocument({outputFile, result}))
    } else if (succeeded) {
      renderSuccess({headline: 'Operation succeeded.', body: `Results written to ${outputFile}`})
    } else {
      outputInfo(`Results written to ${outputFile}`)
    }
  } else {
    if (format === 'text' && succeeded) renderSuccess({headline: 'Operation succeeded.'})
    outputResult(payload)
  }

  if (result.failure) {
    throw new AbortError(`GraphQL operation returned user errors (${result.failure.code}).`)
  }
}
