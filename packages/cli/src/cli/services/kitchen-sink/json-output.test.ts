import {createKitchenSinkJsonOutput, kitchenSinkJsonOutputSchema} from './json-output.js'
import {runWithCommandEvents} from '@shopify/cli-kit/node/command-events'
import {describe, expect, test, vi} from 'vitest'

describe('kitchen sink JSON output service', () => {
  test('returns a valid result and reports its diagnostic', () => {
    const sink = vi.fn()

    const result = runWithCommandEvents({sink, outputMode: 'json'}, createKitchenSinkJsonOutput)

    expect(kitchenSinkJsonOutputSchema.validate(result)).toEqual({items: [{id: 1, name: 'Example'}]})
    expect(sink).toHaveBeenCalledOnce()
    expect(sink).toHaveBeenCalledWith({
      type: 'diagnostic',
      timestamp: expect.any(String),
      level: 'info',
      message: 'Preparing the sample result.',
    })
  })
})
