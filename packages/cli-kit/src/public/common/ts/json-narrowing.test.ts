import {assertStringMap} from './json-narrowing.js'
import {BugError} from '@shopify/cli-kit/node/error'
import {describe, expect, test} from 'vitest'

describe('json-narrowing', () => {
  test('assertStringMap', () => {
    assertStringMap({yes: 'please'})
  })
  test('assertStringMap fails on null', () => {
    expect(() => assertStringMap(null)).toThrow(BugError)
  })
  test('assertStringMap fails on non-object', () => {
    expect(() => assertStringMap('hello')).toThrow(BugError)
  })
})
