import {appDeployJsonOutputSchema} from './types.js'
import {expect, test} from 'vitest'

test('rejects unexpected fields in the public result', () => {
  expect(() => appDeployJsonOutputSchema.validate({status: 'cancelled', internalId: 'private'})).toThrow()
})
