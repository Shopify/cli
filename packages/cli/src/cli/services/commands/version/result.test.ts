import {presentVersionResult} from './result.js'
import {versionJsonOutputSchema} from './types.js'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {afterEach, describe, expect, test} from 'vitest'

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('presentVersionResult', () => {
  test('writes the raw version text by default', () => {
    const outputMock = mockAndCaptureOutput()

    presentVersionResult({version: '2.2.2'}, 'text')

    expect(outputMock.output()).toBe('2.2.2')
    expect(outputMock.warn()).toBe('')
  })

  test('writes one JSON document when requested', () => {
    const outputMock = mockAndCaptureOutput()

    presentVersionResult({version: '2.2.2'}, 'json')

    expect(outputMock.output()).toBe(JSON.stringify({version: '2.2.2'}, null, 2))
    expect(JSON.parse(outputMock.output())).toEqual({version: '2.2.2'})
  })
})

describe('version JSON result contract', () => {
  test('encodes an object with a version string', () => {
    expect(versionJsonOutputSchema.encode({version: '2.2.2'})).toBe(JSON.stringify({version: '2.2.2'}, null, 2))
  })

  test.each([['2.2.2'], [{}], [{version: 1}]])('rejects %j', (value) => {
    expect(() => versionJsonOutputSchema.validate(value)).toThrow()
  })

  test('declares a closed object schema with a required version string', () => {
    expect(versionJsonOutputSchema.jsonSchema).toMatchObject({
      type: 'object',
      properties: {version: {type: 'string'}},
      required: ['version'],
      additionalProperties: false,
    })
  })
})
