import {API_NAME_LIMIT, generateThemeName} from './generate-theme-name.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {hostname} from 'os'
import {randomBytes} from 'crypto'

vi.mock('os')
vi.mock('crypto')

describe('generateThemeName', () => {
  const context = 'Development'

  beforeEach(() => {
    vi.mocked(randomBytes).mockImplementation(() => Buffer.from([1, 2, 3]))
  })

  test('should not truncate if the theme name is below the API limit', () => {
    vi.mocked(hostname).mockReturnValue('Mac-Book-Pro.My-Router')
    expect(generateThemeName(context)).toEqual('Development (010203-Mac-Book-Pro)')
  })

  test('should truncate if the theme name is above the API limit', () => {
    vi.mocked(hostname).mockReturnValue('theme-dev-lan-very-long-name-that-will-be-truncated')
    const themeName = generateThemeName(context)
    expect(themeName.length).toBe(API_NAME_LIMIT)
    expect(themeName).toEqual('Development (010203-theme-dev-lan-very-long-name-)')
  })
})
