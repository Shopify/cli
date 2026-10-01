import {executeLogsQuery, logsJsonOutputSchema, type LogsQueryOptions} from './logs-query.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {
  buildClientSchema,
  assertValidSchema,
  getIntrospectionQuery,
  lexicographicSortSchema,
  printSchema,
  type IntrospectionQuery,
  Kind,
  parse,
  print,
} from 'graphql'

interface LogsSchemaOptions extends Pick<LogsQueryOptions, 'noPrompt' | 'demo'> {
  appKey: string
  json: boolean
}

export async function fetchLogsSchema(options: LogsSchemaOptions): Promise<{output: string; failed: boolean}> {
  const document = parse(
    getIntrospectionQuery({
      descriptions: true,
      specifiedByUrl: true,
      directiveIsRepeatable: true,
      inputValueDeprecation: true,
    }),
  )
  const scope = parse(`{ app(key: ${JSON.stringify(options.appKey)}) { key } }`).definitions[0]!
  if (scope.kind !== Kind.OPERATION_DEFINITION) throw new AbortError('Invalid schema scope.')
  const query = print({
    ...document,
    definitions: document.definitions.map((definition) =>
      definition.kind === Kind.OPERATION_DEFINITION
        ? {
            ...definition,
            selectionSet: {
              ...definition.selectionSet,
              selections: [...scope.selectionSet.selections, ...definition.selectionSet.selections],
            },
          }
        : definition,
    ),
  })
  const {response, failed} = await executeLogsQuery({noPrompt: options.noPrompt, demo: options.demo, query})
  if (failed) return {output: logsJsonOutputSchema.encode(response), failed}

  let schema
  try {
    schema = buildClientSchema(response.data as unknown as IntrospectionQuery)
    assertValidSchema(schema)
  } catch {
    throw new AbortError('App logs returned incomplete or invalid introspection data.')
  }
  return {
    output: options.json ? logsJsonOutputSchema.encode(response) : printSchema(lexicographicSortSchema(schema)),
    failed: false,
  }
}
