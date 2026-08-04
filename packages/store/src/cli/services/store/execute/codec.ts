import type {StoreExecuteResult, StoreExecuteWriteReceipt} from './types.js'

export function encodeStoreExecuteResult(result: StoreExecuteResult): string {
  return JSON.stringify(result.data, null, 2)
}

export function encodeStoreExecuteWriteReceipt(input: {outputFile: string; result: StoreExecuteResult}): string {
  const receipt: StoreExecuteWriteReceipt = {
    outputFile: input.outputFile,
    success: !input.result.failure,
    ...(input.result.failure ? {failureCode: input.result.failure.code} : {}),
  }
  return JSON.stringify(receipt, null, 2)
}
