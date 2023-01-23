import {generateDevelopmentThemeName} from './generate-development-theme-name.js'
import {describe, expect, it} from 'vitest'

describe('generateName', () => {
  function randomBytes() {
    return Buffer.from([1, 2, 3])
  }

  it('should not truncate if the theme name is below the API limit', () => {
    expect(generateDevelopmentThemeName(() => 'Mac-Book-Pro.My-Router', randomBytes)).toEqual(
      'Development (010203-Mac-Book-Pro)',
    )
  })

  it('should truncate if the theme name is above the API limit', () => {
    expect(
      generateDevelopmentThemeName(() => 'theme-dev-lan-very-long-name-that-will-be-truncated', randomBytes),
    ).toEqual('Development (010203-theme-dev-lan-very-long-name-t)')
  })
})
