import {Version} from './semver.js'
import {describe, expect, test} from 'vitest'

describe('Version', () => {
  test('initializes when the version is valid', () => {
    // Given
    const version = new Version('2.3.1')

    // When/Then
    expect(version.major).toEqual(2)
    expect(version.minor).toEqual(3)
    expect(version.patch).toEqual(1)
  })

  test('throws if the version is invalid', () => {
    // Given
    expect(() => {
      // eslint-disable-next-line no-new
      new Version('invalid')
    }).toThrowError()
  })
})
