export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | {[key: string]: JsonValue}

export interface StoreExecuteFailure {
  code: 'USER_ERRORS'
  details: JsonValue
}

export interface StoreExecuteResult {
  data: JsonValue
  failure?: StoreExecuteFailure
}

/**
 * Describes where an operation payload was written. This is not the payload itself: the payload is
 * the caller's own GraphQL result in `StoreExecuteResult.data`.
 */
export interface StoreExecuteWriteReceipt {
  outputFile: string
  success: boolean
  failureCode?: string
}
