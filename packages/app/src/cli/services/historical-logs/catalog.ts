import {AbortError} from '@shopify/cli-kit/node/error'

const logTypes = [
  {name: 'webhook', backend: 'WEBHOOK_DELIVERY'},
  {name: 'graphql', backend: 'GRAPHQL_REQUEST'},
] as const

export const logFilters = [
  {flag: 'store', field: 'SHOP_MYSHOPIFY_DOMAIN'},
  {flag: 'status', field: 'RESULT_STATUS'},
  {flag: 'topic', field: 'TOPIC'},
  {flag: 'status-code', field: 'STATUS_CODE'},
  {flag: 'operation-type', field: 'OPERATION_TYPE'},
  {flag: 'operation-name', field: 'OPERATION_NAME'},
  {flag: 'request-id', field: 'REQUEST_ID'},
] as const

export const queryLimits = {
  defaultLimit: 20,
  defaultSince: '1h',
  maximumLimit: 1000,
}

export function logError(code: string, message: string, requestId?: string | null): AbortError {
  const error = new AbortError(requestId ? `${message}\n\nRequest ID: ${requestId}` : message)
  error.code = code
  if (requestId) error.details = {requestId}
  return error
}

function selectedLogType(value?: string) {
  const type = logTypes.find(({name}) => name === value)
  if (!type) throw logError('INVALID_ARGUMENT', 'Supported log types are webhook and graphql.')
  return type
}

export function selectedLogTypes(values?: string | string[]) {
  if (values === undefined) return [...logTypes]
  return [...new Set(typeof values === 'string' ? [values] : values)].map(selectedLogType)
}
