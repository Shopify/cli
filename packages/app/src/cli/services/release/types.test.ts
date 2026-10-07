import {appReleaseJsonOutputSchema} from './types.js'
import {expect, test} from 'vitest'

test('rejects unexpected fields in the public result', () => {
  expect(() => appReleaseJsonOutputSchema.validate({status: 'cancelled', internalId: 'private'})).toThrow()
})
