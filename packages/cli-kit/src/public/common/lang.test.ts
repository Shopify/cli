import {isEqual} from './lang.js'
import {describe, test, expect} from 'vitest'

describe('isEqual', () => {
  test('returns true when two objects are equal', () => {
    expect(isEqual({foo: {bar: 'test'}}, {foo: {bar: 'test'}})).toBeTruthy()
  })
  test('returns false when two objects are equal', () => {
    expect(isEqual({foo: {bar: 'test'}}, {foo: {bar: 'bar'}})).toBeFalsy()
  })
})
