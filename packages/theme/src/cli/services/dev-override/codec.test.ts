import {encodeThemePreviewResult} from './codec.js'
import {themePreviewJsonOutputSchema} from './types.js'
import {expect, test} from 'vitest'

const result = {url: 'https://abc123.shopifypreview.com', preview_identifier: 'abc123'}

test('preserves the compact JSON wire format and key order', () => {
  expect(encodeThemePreviewResult(result)).toBe(
    '{"url":"https://abc123.shopifypreview.com","preview_identifier":"abc123"}',
  )
})

test('omits internal API fields', () => {
  const response = {...result, internal: 'private'}
  expect(JSON.parse(encodeThemePreviewResult(response))).toEqual(result)
})

test.each([
  {url: null, preview_identifier: 'abc123'},
  {url: 'https://abc123.shopifypreview.com', preview_identifier: 123},
  {url: 'https://abc123.shopifypreview.com'},
  {preview_identifier: 'abc123'},
])('rejects invalid preview results %j', (invalid) => {
  expect(() => themePreviewJsonOutputSchema.validate(invalid)).toThrow()
})
