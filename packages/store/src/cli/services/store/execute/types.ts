export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | {[key: string]: JsonValue}

export interface StoreExecuteResult {
  data: JsonValue
}

/**
 * Describes where an operation payload was written. This is not the payload itself: the payload is
 * the caller's own GraphQL result in `StoreExecuteResult.data`.
 */
export interface StoreExecuteWriteReceipt {
  outputFile: string
}
