import {fetchLogsSchema} from './logs-schema.js'
import {executeLogsQuery, logsJsonOutputSchema} from './logs-query.js'
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
  GraphQLInt,
  graphqlSync,
} from 'graphql'
import {expect, test, vi} from 'vitest'

vi.mock('./logs-query.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./logs-query.js')>()),
  executeLogsQuery: vi.fn(),
}))

const options = {api: 'app-logs', noPrompt: true, demo: true, json: false, variables: '{"organizationId":5}'}

test('fetches live SDL with descriptions, defaults, nested types and deprecations', async () => {
  const status = new GraphQLEnumType({
    name: 'Status',
    values: {SUCCESS: {description: 'Delivery succeeded.'}, FAILED: {}},
  })
  const event = new GraphQLObjectType({
    name: 'Event',
    fields: {
      status: {type: new GraphQLNonNull(status)},
      old: {type: GraphQLString, deprecationReason: 'Use status'},
    },
  })
  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      description: 'Available log queries.',
      fields: {
        logs: {
          type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(event))),
          args: {limit: {type: GraphQLInt, defaultValue: 50}},
        },
      },
    }),
  })
  vi.mocked(executeLogsQuery).mockImplementation(async ({query}) => {
    const response = graphqlSync({schema, source: query!})
    expect(response.errors).toBeUndefined()
    return {response: logsJsonOutputSchema.schema.parse(response), failed: false}
  })

  const result = await fetchLogsSchema(options)

  expect(result.failed).toBe(false)
  expect(result.output).toContain('"""Available log queries."""')
  expect(result.output).toContain('logs(limit: Int = 50): [Event!]!')
  expect(result.output).toContain('@deprecated(reason: "Use status")')
  expect(result.output).toContain('"""Delivery succeeded."""')
  expect(executeLogsQuery).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({api: 'app-logs', variables: options.variables, noPrompt: true, demo: true}),
  )
})

test('JSON mode preserves the complete introspection response', async () => {
  let expectedResponse
  vi.mocked(executeLogsQuery).mockImplementation(async ({query}) => {
    const response = {
      ...graphqlSync({
        schema: new GraphQLSchema({
          query: new GraphQLObjectType({name: 'Query', fields: {ping: {type: GraphQLString}}}),
        }),
        source: query!,
      }),
      extensions: {id: 'request'},
    }
    expectedResponse = response
    return {response: logsJsonOutputSchema.schema.parse(response), failed: false}
  })

  const result = await fetchLogsSchema({...options, json: true})

  expect(JSON.parse(result.output)).toEqual(expectedResponse)
  expect(result.failed).toBe(false)
})

test.each([false, true])('failed introspection preserves errors without printing SDL (json=%s)', async (json) => {
  const response = {data: null, errors: [{message: 'Denied', extensions: {code: 'FORBIDDEN'}}]}
  vi.mocked(executeLogsQuery).mockResolvedValue({response, failed: true})

  await expect(fetchLogsSchema({...options, json})).resolves.toEqual({
    output: JSON.stringify(response, null, 2),
    failed: true,
  })
})

test('HTTP failure without GraphQL errors remains a failure', async () => {
  vi.mocked(executeLogsQuery).mockResolvedValue({response: {data: null}, failed: true})
  await expect(fetchLogsSchema(options)).resolves.toEqual({output: JSON.stringify({data: null}, null, 2), failed: true})
})

test.each([null, {}, {__schema: {types: []}}])('incomplete introspection is rejected: %j', async (data) => {
  vi.mocked(executeLogsQuery).mockResolvedValue({response: {data}, failed: false})
  await expect(fetchLogsSchema(options)).rejects.toThrow('incomplete or invalid introspection')
})

test('transport failure is not converted to an empty schema', async () => {
  vi.mocked(executeLogsQuery).mockRejectedValue(new Error('Connection refused'))
  await expect(fetchLogsSchema(options)).rejects.toThrow('Connection refused')
})
