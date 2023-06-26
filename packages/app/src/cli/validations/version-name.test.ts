import {validateVersion} from './version-name.js'
import {describe, expect, test} from 'vitest'

describe('validateVersion', () => {
  test('when version value meets all requirements should not throw any error', async () => {
    // Given
    const version = 'AZaz09.-_/'

    // When
    expect(() => validateVersion(version)).not.toThrow()
  })
  ;['.', '..'].forEach((invalidVersionString: string) => {
    test(`when version is specified as invalid string ${invalidVersionString}`, async () => {
      // When
      expect(() => validateVersion(invalidVersionString)).toThrowError(`Invalid version name: ${invalidVersionString}`)
    })
  })

  test('when version value violates unsupported characters requirements', async () => {
    // Given
    const versionWithUnsupportedCharacters = 'AZa%&\n'

    // When
    expect(() => validateVersion(versionWithUnsupportedCharacters)).toThrowError(
      `Invalid version name: ${versionWithUnsupportedCharacters}`,
    )
  })

  test('when version value violates max length requirement', async () => {
    // Given
    const versionLong = 'A'.repeat(101)

    // When
    expect(() => validateVersion(versionLong)).toThrowError(`Invalid version name: ${versionLong}`)
  })
})
