export interface ErrorResponse {
  errors: {
    status: number
    message: string
  }[]
}

export interface AppLogData {
  shop_id: number
  api_client_id: number
  payload: string
  log_type: string
  source: string
  source_namespace: string
  cursor: string
  status: 'success' | 'failure'
  log_timestamp: string
}

export class FunctionRunLog {
  export: string
  input: unknown
  inputBytes: number
  output: unknown
  outputBytes: number
  logs: string
  functionId: string
  fuelConsumed: number
  target: string
  errorMessage: string | null
  errorType: string | null
  inputQueryVariablesMetafieldValue: unknown
  inputQueryVariablesMetafieldNamespace: string | null
  inputQueryVariablesMetafieldKey: string | null

  constructor({
    export: exportValue,
    input,
    inputBytes,
    output,
    outputBytes,
    logs,
    functionId,
    fuelConsumed,
    target,
    errorMessage,
    errorType,
    inputQueryVariablesMetafieldValue,
    inputQueryVariablesMetafieldNamespace,
    inputQueryVariablesMetafieldKey,
  }: {
    export: string
    input: unknown
    inputBytes: number
    output: unknown
    outputBytes: number
    logs: string
    functionId: string
    fuelConsumed: number
    target: string
    errorMessage: string | null
    errorType: string | null
    inputQueryVariablesMetafieldValue: unknown
    inputQueryVariablesMetafieldNamespace: string | null
    inputQueryVariablesMetafieldKey: string | null
  }) {
    this.export = exportValue
    this.input = input
    this.inputBytes = inputBytes
    this.output = output
    this.outputBytes = outputBytes
    this.logs = logs
    this.functionId = functionId
    this.fuelConsumed = fuelConsumed
    this.target = target
    this.errorMessage = errorMessage
    this.errorType = errorType
    this.inputQueryVariablesMetafieldValue = inputQueryVariablesMetafieldValue
    this.inputQueryVariablesMetafieldNamespace = inputQueryVariablesMetafieldNamespace
    this.inputQueryVariablesMetafieldKey = inputQueryVariablesMetafieldKey
  }
}
