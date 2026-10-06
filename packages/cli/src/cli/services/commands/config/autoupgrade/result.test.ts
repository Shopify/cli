import {presentAutoUpgradeResult} from './result.js'
import {autoUpgradeJsonOutputSchema} from './types.js'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {afterEach, expect, test} from 'vitest'

afterEach(() => {
  mockAndCaptureOutput().clear()
})

test.each([true, false])('encodes the enabled preference %s', (enabled) => {
  expect(autoUpgradeJsonOutputSchema.encode({enabled})).toBe(JSON.stringify({enabled}, null, 2))
})

test.each([{}, {enabled: 'false'}, {enabled: null}, {enabled: false, message: 'disabled'}])(
  'rejects an invalid result %j',
  (value) => {
    expect(() => autoUpgradeJsonOutputSchema.validate(value)).toThrow()
  },
)

test('declares a closed result with a required boolean', () => {
  expect(autoUpgradeJsonOutputSchema.jsonSchema).toMatchObject({
    type: 'object',
    properties: {enabled: {type: 'boolean'}},
    required: ['enabled'],
    additionalProperties: false,
  })
})

test.each([true, false])('writes one JSON result for preference %s without a terminal banner', async (enabled) => {
  await withCapturedStandardStreams(({stdout, stderr}) => {
    presentAutoUpgradeResult({enabled}, 'json')

    expect(stdout()).toBe(`${JSON.stringify({enabled}, null, 2)}\n`)
    expect(JSON.parse(stdout())).toEqual({enabled})
    expect(stderr()).toBe('')
  })
})

test.each([
  [true, 'Auto-upgrade on. Shopify CLI will update automatically after each command.'],
  [false, "Auto-upgrade off. You'll need to run `shopify upgrade` to update manually."],
] as const)('keeps text presentation on stderr for preference %s', async (enabled, message) => {
  await withCapturedStandardStreams(({stdout, stderr}) => {
    presentAutoUpgradeResult({enabled}, 'text')

    expect(stdout()).toBe('')
    expect(stderr()).toContain(message)
  })
})
