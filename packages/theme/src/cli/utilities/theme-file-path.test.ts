import {validateListingName} from './theme-file-path.js'
import {test, describe, expect} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'

describe('validateListingName', () => {
  test.each([
    ['an empty name', ''],
    ['the current directory', '.'],
    ['the parent directory', '..'],
    ['a POSIX separator', 'modern/../../outside'],
    ['a Windows separator', 'modern\\..\\..\\outside'],
    ['a leading POSIX separator', '/outside'],
    ['a leading Windows separator', '\\outside'],
    ['an uppercase drive letter', 'C:\\outside'],
    ['a lowercase drive letter', 'c:outside'],
  ])('rejects a listing name containing %s', (_description, listingName) => {
    expect(() => validateListingName(listingName)).toThrow(AbortError)
  })

  test.each([['modern'], ['two-words'], ['..periods'], ['...']])(
    'accepts the listing name %s, which stays inside the listings directory',
    (listingName) => {
      expect(() => validateListingName(listingName)).not.toThrow()
    },
  )
})
