import {encodeThemePreviewResult} from './codec.js'
import {themePreviewJsonOutputSchema} from './types.js'
import {expect, test} from 'vitest'

const result = {url: 'https://abc123.shopifypreview.com', preview_identifier: 'abc123'}

test('projects the native preview response to the strict public result', () => {
  expect(JSON.parse(encodeThemePreviewResult(result))).toEqual({
    status: 'success',
    preview: {id: 'abc123', url: result.url},
  })
})

test('omits internal API fields', () => {
  const response = {...result, internal: 'private'}
  expect(JSON.parse(encodeThemePreviewResult(response))).toEqual({
    status: 'success',
    preview: {id: 'abc123', url: result.url},
  })
})

test.each([
  {url: null, preview_identifier: 'abc123'},
  {url: 'https://abc123.shopifypreview.com', preview_identifier: 123},
  {url: 'https://abc123.shopifypreview.com'},
  {preview_identifier: 'abc123'},
])('rejects invalid preview results %j', (invalid) => {
  expect(() => themePreviewJsonOutputSchema.validate(invalid)).toThrow()
})

test('validates the opaque preview namespace, URL and strict object fields', () => {
  const output = JSON.parse(encodeThemePreviewResult(result))
  expect(themePreviewJsonOutputSchema.validate(output)).toEqual(output)
  expect(() => themePreviewJsonOutputSchema.validate({...output, unknown: true})).toThrow()
  expect(() => themePreviewJsonOutputSchema.validate({...output, preview: {...output.preview, id: ''}})).toThrow()
  expect(() =>
    themePreviewJsonOutputSchema.validate({...output, preview: {...output.preview, url: 'invalid'}}),
  ).toThrow()
  expect(() =>
    themePreviewJsonOutputSchema.validate({...output, preview: {...output.preview, unknown: true}}),
  ).toThrow()
})
