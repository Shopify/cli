import {AbortError} from '@shopify/cli-kit/node/error'

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

type LogFilterFlag = (typeof logFilters)[number]['flag']

// Filters that every log type records. Each type lists the other filters that apply to it.
export const commonLogFilters = ['store'] as const satisfies ReadonlyArray<LogFilterFlag>

// App events record no result status, so --status applies to every other type.
export const logTypes = [
  {
    name: 'webhook',
    backend: 'WEBHOOK',
    description: 'Webhook deliveries.',
    filters: ['status', 'topic', 'status-code'],
  },
  {
    name: 'graphql',
    backend: 'GRAPHQL_REQUEST',
    description: 'GraphQL API requests.',
    filters: ['status', 'operation-type', 'operation-name', 'request-id'],
  },
  {
    name: 'function',
    backend: 'FUNCTION_RUN',
    description: 'Shopify Function runs.',
    filters: ['status', 'function-handle', 'target'],
  },
  {
    name: 'app-event',
    backend: 'APP_EVENT',
    description: 'Events the app sent with the App Events API.',
    filters: ['event-handle'],
  },
  {
    name: 'app-billing-event',
    backend: 'APP_BILLING_EVENT',
    description: 'Billing outcomes of app events.',
    filters: ['status', 'event-handle'],
  },
  {
    name: 'rest',
    backend: 'REST_REQUEST',
    description: 'REST API requests.',
    filters: ['status', 'status-code', 'request-id', 'method', 'request-path'],
  },
  {name: 'sidekick', backend: 'SIDEKICK_EVENT', description: 'Sidekick events.', filters: ['status', 'target']},
  {name: 'ui-extension', backend: 'UI_EXTENSION', description: 'UI extension errors.', filters: ['status', 'target']},
] as const satisfies ReadonlyArray<{
  name: string
  backend: string
  description: string
  filters: ReadonlyArray<LogFilterFlag>
}>

export const logTypeNames = logTypes.map(({name}) => name)

export function logTypesHelp(): string {
  const rows = logTypes.map(
    ({name, description, filters}) =>
      `- ${name}: ${description} Filters: ${filters.map((flag) => `--${flag}`).join(', ')}.`,
  )
  const common = commonLogFilters.map((flag) => `--${flag}`).join(', ')
  return [`Log types and the filters that apply to each. Every type also accepts ${common}.`, '', ...rows].join('\n')
}

export const queryLimits = {
  defaultLimit: 20,
  defaultSince: '1h',
  maximumLimit: 1000,
  maximumLookbackDays: 7,
  maximumWindowDays: 1,
  maximumFutureSkewMinutes: 1,
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
      `Supported log types are ${new Intl.ListFormat('en', {type: 'conjunction'}).format(logTypeNames)}.`,
    )
  return {name: type.name, backend: type.backend}
}

export function selectedLogTypes(values: string | string[] = logTypeNames) {
  return [...new Set(typeof values === 'string' ? [values] : values)].map(selectedLogType)
}
