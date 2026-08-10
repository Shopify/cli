import type {StoreExecuteResult, StoreExecuteWriteReceipt} from './types.js'

export function encodeStoreExecuteResult(result: StoreExecuteResult): string {
  return JSON.stringify(result.data, null, 2)
}

export function encodeStoreExecuteWriteReceipt(input: {outputFile: string}): string {
  const receipt: StoreExecuteWriteReceipt = {outputFile: input.outputFile}
  return JSON.stringify(receipt, null, 2)
}
