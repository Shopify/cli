import {appLogSourcesJsonOutputSchema} from './types.js'
import {sources} from '../sources.js'
import {testApp, testFunctionExtension} from '../../../models/app/app.test-data.js'
import {expect, test} from 'vitest'

test('encodes source metadata and preserves dynamic configuration fields', async () => {
  const extension = await testFunctionExtension()
  const result = sources(testApp({allExtensions: [extension]}))
  expect(JSON.parse(appLogSourcesJsonOutputSchema.encode(result))).toEqual(JSON.parse(JSON.stringify(result)))
  expect(appLogSourcesJsonOutputSchema.encode([])).toBe('[]')
})

test.each([{value: {}}, {value: [1]}, {value: [null]}, {value: ['extensions.example']}])(
  'rejects invalid sources: $value',
  ({value}) => {
    expect(() => appLogSourcesJsonOutputSchema.validate(value)).toThrow()
  },
)

test('rejects malformed metadata and omits absent optional fields', async () => {
  const result = sources(testApp({allExtensions: [await testFunctionExtension()]}))[0]!
  expect(() => appLogSourcesJsonOutputSchema.validate([{...result, uid: null}])).toThrow()
  expect(() => appLogSourcesJsonOutputSchema.validate([{...result, features: [false]}])).toThrow()
  expect(JSON.parse(appLogSourcesJsonOutputSchema.encode([{...result, dependency: undefined}]))[0]).not.toHaveProperty(
    'dependency',
  )
})
