import {executeLogsQuery, logsJsonOutputSchema} from './logs-query.js'
import {resolveLogsApp, type LogsScopeOptions} from './logs-search.js'
import {zod} from '@shopify/cli-kit/node/schema'

const namedValues = zod.array(zod.object({name: zod.string(), description: zod.string().nullable()}))
const filterDefinitions = zod.array(
  zod.object({
    field: zod.string(),
    description: zod.string(),
    operators: zod.array(zod.string()),
    valueType: zod.string(),
  }),
)

export async function discoverLogs(
  options: LogsScopeOptions & {kind: 'types' | 'filters'; types?: string[]; json: boolean},
) {
  const appKey = await resolveLogsApp(options)
  const query =
    options.kind === 'types'
      ? `query LogTypes($appKey: String!) {
        app(key: $appKey) { key }
        __type(name: "LogEventType") { enumValues { name description } }
      }`
      : `query LogFilters($appKey: String!, $types: [LogEventType!]) {
        app(key: $appKey) { key logFilterDefinitions(types: $types) { field description operators valueType } }
      }`
  const {response, failed} = await executeLogsQuery({
    noPrompt: options.noPrompt,
    demo: options.demo,
    query,
    variables: JSON.stringify({appKey, types: options.types}),
  })
  if (failed || options.json) return {output: logsJsonOutputSchema.encode(response), failed}
  if (options.kind === 'types') {
    const data = zod.object({__type: zod.object({enumValues: namedValues})}).parse(response.data)
    return {
      output: data.__type.enumValues.map(({name, description}) => `${name}  ${description ?? ''}`).join('\n'),
      failed,
    }
  }
  const data = zod.object({app: zod.object({logFilterDefinitions: filterDefinitions})}).parse(response.data)
  return {
    output: data.app.logFilterDefinitions
      .map(
        ({field, description, operators, valueType}) =>
          `${field} (${valueType}; ${operators.join(', ')})\n  ${description}`,
      )
      .join('\n\n'),
    failed,
  }
}
