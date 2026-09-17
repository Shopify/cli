import {appLogSourcesJsonOutputSchema} from './types.js'
import {expect, test} from 'vitest'

test('encodes all sources in order, including an empty collection', () => {
  expect(appLogSourcesJsonOutputSchema.encode(['extensions.first', 'extensions.second'])).toBe(
    '[\n  "extensions.first",\n  "extensions.second"\n]',
  )
  expect(appLogSourcesJsonOutputSchema.encode([])).toBe('[]')
})

test.each([{value: {}}, {value: [1]}, {value: [null]}])('rejects invalid sources: $value', ({value}) => {
  expect(() => appLogSourcesJsonOutputSchema.validate(value)).toThrow()
})
