import {createKitchenSinkJsonOutput, kitchenSinkJsonOutputSchema} from './json-output.js'
import {describe, expect, test} from 'vitest'

describe('kitchen sink JSON output service', () => {
  test('returns a valid result', () => {
    const result = createKitchenSinkJsonOutput()

    expect(kitchenSinkJsonOutputSchema.validate(result)).toEqual({items: [{id: 1, name: 'Example'}]})
  })
})
