import {functionBuildJsonOutputSchema} from './types.js'
import {expect, test} from 'vitest'

function fixture() {
  return {
    status: 'success' as const,
    function: {handle: null, name: 'My Function', directory: '/function', wasmPath: null},
  }
}

test.each([
  {field: 'directory', value: 'relative/path'},
  {field: 'wasmPath', value: 'relative/file.wasm'},
  {field: 'unexpected', value: true},
])('rejects invalid Function $field values', ({field, value}) => {
  const result = fixture()
  expect(() =>
    functionBuildJsonOutputSchema.encode({...result, function: {...result.function, [field]: value}}),
  ).toThrow()
})

test('rejects unknown root fields', () => {
  const result = {...fixture(), unexpected: true}
  expect(() => functionBuildJsonOutputSchema.encode(result)).toThrow()
})

test.each(['/function/index.wasm', 'C:\\function\\index.wasm', '\\\\server\\function\\index.wasm'])(
  'accepts native absolute artifact paths: %s',
  (wasmPath) => {
    const result = fixture()
    expect(
      JSON.parse(functionBuildJsonOutputSchema.encode({...result, function: {...result.function, wasmPath}})).function
        .wasmPath,
    ).toBe(wasmPath)
  },
)
