import {AbortError} from '@shopify/cli-kit/node/error'

const logTypes = [
  {name: 'webhook', backend: 'WEBHOOK'},
  {name: 'graphql', backend: 'GRAPHQL_REQUEST'},
  {name: 'function', backend: 'FUNCTION_RUN'},
  {name: 'app-event', backend: 'APP_EVENT'},
  {name: 'app-billing-event', backend: 'APP_BILLING_EVENT'},
  {name: 'rest', backend: 'REST_REQUEST'},
  {name: 'sidekick', backend: 'SIDEKICK_EVENT'},
  {name: 'ui-extension', backend: 'UI_EXTENSION'},
] as const

export const logFilters = [
  {flag: 'store', field: 'SHOP_MYSHOPIFY_DOMAIN'},
  {flag: 'status', field: 'RESULT_STATUS'},
  {flag: 'topic', field: 'TOPIC'},
  {flag: 'status-code', field: 'STATUS_CODE'},
  {flag: 'operation-type', field: 'OPERATION_TYPE'},
  {flag: 'operation-name', field: 'OPERATION_NAME'},
  {flag: 'request-id', field: 'REQUEST_ID'},
  {flag: 'function-handle', field: 'FUNCTION_HANDLE'},
  {flag: 'target', field: 'TARGET'},
  {flag: 'event-handle', field: 'EVENT_HANDLE'},
  {flag: 'method', field: 'METHOD'},
  {flag: 'request-path', field: 'REQUEST_PATH'},
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
  if (!type)
    throw logError(
      'invalid-argument',
      'Supported log types are webhook, graphql, function, app-event, app-billing-event, rest, sidekick, and ui-extension.',
    )
  return type
}

export function selectedLogTypes(values?: string | string[]) {
  if (values === undefined) return [...logTypes]
  return [...new Set(typeof values === 'string' ? [values] : values)].map(selectedLogType)
}
