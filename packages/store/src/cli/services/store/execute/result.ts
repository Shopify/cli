import {encodeStoreExecuteWriteReceipt, encodeStoreExecuteResult} from './codec.js'
import {writeFile} from '@shopify/cli-kit/node/fs'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import type {StoreExecuteResult} from './types.js'

type StoreExecuteOutputFormat = 'text' | 'json'

export async function writeOrOutputStoreExecuteResult(
  result: StoreExecuteResult,
  outputFile?: string,
  format: StoreExecuteOutputFormat = 'text',
): Promise<void> {
  const payload = encodeStoreExecuteResult(result)

  if (outputFile) {
    await writeFile(outputFile, payload)

    if (format === 'json') {
      outputResult(encodeStoreExecuteWriteReceipt({outputFile}))
    } else {
      renderSuccess({headline: 'Operation succeeded.', body: `Results written to ${outputFile}`})
    }
  } else {
    if (format === 'text') renderSuccess({headline: 'Operation succeeded.'})
    outputResult(payload)
  }
}
