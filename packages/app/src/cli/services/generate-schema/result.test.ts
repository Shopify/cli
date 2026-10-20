import {functionSchemaJsonOutputSchema} from './types.js'
import {expect, test} from 'vitest'

test.each([
  {path: 'relative/schema.graphql', format: 'graphql'},
  {path: '/schema.graphql', format: 'json'},
  {path: '/schema.graphql', format: 'graphql', unexpected: true},
  {schema: 'type Query { field: String }', unexpected: true},
  {schema: 12},
])('rejects invalid result projections: %j', (result) => {
  expect(() => functionSchemaJsonOutputSchema.validate(result)).toThrow()
})

test.each(['/schema.graphql', 'C:\\function\\schema.graphql', '\\\\server\\function\\schema.graphql'])(
  'encodes absolute native file paths: %s',
  (path) => {
    expect(JSON.parse(functionSchemaJsonOutputSchema.encode({path, format: 'graphql'}))).toEqual({
      path,
      format: 'graphql',
    })
  },
)
