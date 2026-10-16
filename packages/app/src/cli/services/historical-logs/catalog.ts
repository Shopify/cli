import {AbortError} from '@shopify/cli-kit/node/error'

const logTypes = [
  {name: 'webhook', backend: 'WEBHOOK_DELIVERY', description: 'Webhook delivery attempts.'},
  {
    name: 'graphql',
    backend: 'GRAPHQL_REQUEST',
    description: 'GraphQL API requests across API targets, not only Admin.',
  },
] as const

export const logFilters = [
  {flag: 'store', field: 'SHOP_MYSHOPIFY_DOMAIN', types: ['webhook', 'graphql']},
  {flag: 'status', field: 'RESULT_STATUS', types: ['webhook', 'graphql']},
  {flag: 'topic', field: 'TOPIC', types: ['webhook']},
  {flag: 'status-code', field: 'STATUS_CODE', types: ['webhook']},
  {flag: 'operation-type', field: 'OPERATION_TYPE', types: ['graphql']},
  {flag: 'operation-name', field: 'OPERATION_NAME', types: ['graphql']},
  {flag: 'request-id', field: 'REQUEST_ID', types: ['graphql']},
] as const

export const queryLimits = {
  defaultLimit: 20,
  defaultSince: '1h',
  maximumLimit: 1000,
}

export function logError(code: string, message: string): AbortError {
  const error = new AbortError(message)
  error.code = code
  return error
}

function selectedLogType(value?: string) {
  const type = logTypes.find(({name}) => name === value)
  if (!type) throw logError('INVALID_ARGUMENT', 'Supported log types are webhook and graphql.')
  return type
}

export function selectedLogTypes(values?: string[]) {
  return values === undefined ? [...logTypes] : [...new Set(values)].map(selectedLogType)
}
