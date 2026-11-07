import {appExecuteJsonOutputSchema} from './types.js'
import {expect, test} from 'vitest'

test('keeps native objects strict only at the CLI wrapper', () => {
  expect(appExecuteJsonOutputSchema.validate({data: null})).toEqual({data: null})
  expect(() => appExecuteJsonOutputSchema.validate({data: []})).toThrow()
  expect(() => appExecuteJsonOutputSchema.validate({data: {}, extensions: []})).toThrow()
  expect(() => appExecuteJsonOutputSchema.validate({data: {}, internal: true})).toThrow()
})
