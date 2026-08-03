import type {StoreExecuteResult} from './types.js'

export interface StoreExecuteOutputDocument {
  outputFile: string
  success: boolean
  failureCode?: string
}

export function encodeStoreExecuteResult(result: StoreExecuteResult): string {
  return JSON.stringify(result.data, null, 2)
}

export function encodeStoreExecuteOutputDocument(input: {outputFile: string; result: StoreExecuteResult}): string {
  const document: StoreExecuteOutputDocument = {
    outputFile: input.outputFile,
    success: !input.result.failure,
    ...(input.result.failure ? {failureCode: input.result.failure.code} : {}),
  }
  return JSON.stringify(document, null, 2)
}
