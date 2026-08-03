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
