import {functionReplayEventSchema} from './types.js'
import {expect, test} from 'vitest'

test.each([
  {type: 'status', timestamp: '2026-10-26T09:00:00.123Z', status: 'watching'},
  {type: 'status', timestamp: '2026-10-26T09:00:00Z', status: 'finished'},
  {type: 'build', timestamp: '2026-10-26T09:00:00Z', status: 'success', extra: true},
])('rejects invalid CLI-owned record fields: %j', (record) => {
  expect(() => functionReplayEventSchema.encode(record as never)).toThrow()
})
