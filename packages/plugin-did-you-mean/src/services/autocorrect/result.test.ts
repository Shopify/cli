import {presentAutocorrectResult} from './result.js'
import {autocorrectJsonOutputSchema} from './types.js'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {expect, test} from 'vitest'

test.each([{}, {enabled: 'false'}, {enabled: null}, {enabled: false, message: 'disabled'}])(
  'rejects an invalid result %j',
  (value) => {
    expect(() => autocorrectJsonOutputSchema.validate(value)).toThrow()
  },
)

test.each([true, false])('projects JSON output to the enabled preference %s', async (enabled) => {
  const result = {enabled, internal: 'hidden'}

  await withCapturedStandardStreams(({stdout, stderr}) => {
    presentAutocorrectResult(result, 'json')

    expect(stdout()).toBe(`${JSON.stringify({enabled}, null, 2)}\n`)
    expect(stderr()).toBe('')
  })
})
