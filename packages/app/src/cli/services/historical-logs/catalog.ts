import {AbortError} from '@shopify/cli-kit/node/error'

export const logTypes = [
  {name: 'webhook', backend: 'WEBHOOK_DELIVERY', description: 'Webhook delivery attempts.'},
  {name: 'function', backend: 'FUNCTION_RUN', description: 'Function executions.'},
  {name: 'graphql', backend: 'GRAPHQL_REQUEST', description: 'GraphQL API requests.'},
  {name: 'rest', backend: 'REST_REQUEST', description: 'REST API requests.'},
] as const

type LogType = (typeof logTypes)[number]['name']

export const queryLimits = {
  defaultLimit: 20,
  defaultSince: '1h',
  maximumLimit: 1000,
  retentionDays: 30,
  maximumWindowDays: 7,
}

export function logError(code: string, message: string): AbortError {
  const error = new AbortError(message)
  error.details = {code}
  return error
}

export function selectedLogTypes(values?: string[]): LogType[] {
  if (!values) return logTypes.map(({name}) => name)
  return [...new Set(values)].map((value) => {
    const type = logTypes.find(({name}) => name === value)
    if (!type) {
      throw logError(
        'INVALID_ARGUMENT',
        `Unsupported --type ${value}. Choose webhook, function, graphql, or rest; repeat --type for multiple types.`,
      )
    }
    return type.name
  })
}
