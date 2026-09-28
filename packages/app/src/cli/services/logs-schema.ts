import {executeLogsQuery, logsJsonOutputSchema, type LogsQueryOptions} from './logs-query.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {
  buildClientSchema,
  assertValidSchema,
  getIntrospectionQuery,
  lexicographicSortSchema,
  printSchema,
  type IntrospectionQuery,
} from 'graphql'

interface LogsSchemaOptions extends Pick<LogsQueryOptions, 'api' | 'variables' | 'variableFile' | 'noPrompt' | 'demo'> {
  json: boolean
}

export async function fetchLogsSchema(options: LogsSchemaOptions): Promise<{output: string; failed: boolean}> {
  const {response, failed} = await executeLogsQuery({
    api: options.api,
    variables: options.variables,
    variableFile: options.variableFile,
    noPrompt: options.noPrompt,
    demo: options.demo,
    query: getIntrospectionQuery({
      descriptions: true,
      specifiedByUrl: true,
      directiveIsRepeatable: true,
      inputValueDeprecation: true,
    }),
  })
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
