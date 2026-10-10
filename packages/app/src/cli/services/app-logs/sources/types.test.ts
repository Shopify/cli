import {appLogSourcesJsonOutputSchema} from './types.js'
import {sources} from '../sources.js'
import {testApp, testFunctionExtension} from '../../../models/app/app.test-data.js'
import {expect, test} from 'vitest'

test('encodes source metadata and preserves dynamic configuration fields', async () => {
  const extension = await testFunctionExtension()
  const result = sources(testApp({allExtensions: [extension]}))
  expect(JSON.parse(appLogSourcesJsonOutputSchema.encode({sources: result}))).toEqual({
    sources: JSON.parse(JSON.stringify(result)),
  })
  expect(JSON.parse(appLogSourcesJsonOutputSchema.encode({sources: []}))).toEqual({sources: []})
})

test.each([{value: {}}, {value: [1]}, {value: [null]}, {value: ['extensions.example']}])(
  'rejects invalid sources: $value',
  ({value}) => {
    expect(() => appLogSourcesJsonOutputSchema.validate(value)).toThrow()
  },
)

test('rejects malformed metadata and omits absent optional fields', async () => {
  const result = sources(testApp({allExtensions: [await testFunctionExtension()]}))[0]!
  expect(() => appLogSourcesJsonOutputSchema.validate({sources: [{...result, uid: null}]})).toThrow()
  expect(() => appLogSourcesJsonOutputSchema.validate({sources: [{...result, features: [false]}]})).toThrow()
  expect(
    JSON.parse(appLogSourcesJsonOutputSchema.encode({sources: [{...result, dependency: undefined}]})).sources[0],
  ).not.toHaveProperty('dependency')
})
