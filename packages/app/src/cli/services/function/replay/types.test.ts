import {functionReplayRecordSchema, functionReplayJsonOutputSchema} from './types.js'
import {expect, test} from 'vitest'

test.each([
  {type: 'status', timestamp: '2026-10-26T09:00:00.123Z', status: 'watching'},
  {type: 'status', timestamp: '2026-10-26T09:00:00Z', status: 'finished'},
  {type: 'build', timestamp: '2026-10-26T09:00:00Z', status: 'success', extra: true},
  {type: 'build', timestamp: '2026-10-26T09:00:00Z', status: 'failed'},
  {type: 'build', timestamp: '2026-10-26T09:00:00Z', status: 'success', error: 'Unexpected error'},
])('rejects invalid CLI-owned record fields: %j', (record) => {
  expect(() => functionReplayRecordSchema.encode(record as never)).toThrow()
})

test('describes stdout records and Function execution outcomes', () => {
  const schema = functionReplayJsonOutputSchema.jsonSchema
  expect(schema.definitions).toHaveProperty('FunctionReplayRecord')
  expect(schema.definitions).not.toHaveProperty('FunctionReplayEvent')
  const serialized = JSON.stringify(schema)
  expect(serialized).toContain('The exit code of this Function run, not the replay process.')
  expect(serialized).toContain('False for a completed Function execution that failed.')
  expect(serialized).not.toContain('the command exits nonzero')
})
