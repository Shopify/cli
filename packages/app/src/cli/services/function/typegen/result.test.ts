import {functionTypegenJsonOutputSchema} from './types.js'
import {expect, test} from 'vitest'

function fixture() {
  return {status: 'success' as const, function: {handle: null, name: 'My Function', directory: '/function'}}
}

test.each([
  {field: 'directory', value: 'relative/path'},
  {field: 'handle', value: 123},
  {field: 'unexpected', value: true},
])('rejects invalid Function $field values', ({field, value}) => {
  const result = fixture()
  expect(() =>
    functionTypegenJsonOutputSchema.validate({...result, function: {...result.function, [field]: value}}),
  ).toThrow()
})

test('rejects unknown root fields', () => {
  expect(() => functionTypegenJsonOutputSchema.validate({...fixture(), unexpected: true})).toThrow()
})
