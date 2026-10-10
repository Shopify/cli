import {formatJsonOutputTimestamp, jsonOutputTimestampSchema} from './json-output-schema.js'
import {expect, test} from 'vitest'

test.each([
  ['2026-09-30T12:34:56Z', '2026-09-30T12:34:56Z'],
  ['2026-09-30T12:34:56.999Z', '2026-09-30T12:34:56Z'],
  ['2026-09-30T14:34:56.789+02:00', '2026-09-30T12:34:56Z'],
])('formats %s as a canonical JSON timestamp', (input, expected) => {
  const timestamp = formatJsonOutputTimestamp(new Date(input))

  expect(timestamp).toBe(expected)
  expect(jsonOutputTimestampSchema.parse(timestamp)).toBe(timestamp)
})
