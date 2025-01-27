import {applyIgnoreFilters, getPatternsFromShopifyIgnore} from './asset-ignore.js'
import {ReadOptions, fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {test, describe, beforeEach, vi, expect} from 'vitest'
import {renderWarning} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/fs', async () => {
  const originalFs: any = await vi.importActual('@shopify/cli-kit/node/fs')
  return {
    ...originalFs,
    matchGlob: originalFs.matchGlob,
    readFile: vi.fn(),
    fileExists: vi.fn(),
  }
})

vi.mock('@shopify/cli-kit/node/ui', () => ({
  renderWarning: vi.fn(),
}))

vi.mock('@shopify/cli-kit/node/output')

describe('asset-ignore', () => {
  const checksums = [
    {key: 'assets/basic.css', checksum: '00000000000000000000000000000000'},
    {key: 'assets/complex.css', checksum: '11111111111111111111111111111111'},
    {key: 'assets/image.png', checksum: '22222222222222222222222222222222'},
    {key: 'config/settings_data.json', checksum: '33333333333333333333333333333333'},
    {key: 'config/settings_schema.json', checksum: '44444444444444444444444444444444'},
    {key: 'sections/announcement-bar.liquid', checksum: '55555555555555555555555555555555'},
    {key: 'templates/404.json', checksum: '6666666666666666666666666666666'},
    {key: 'templates/customers/account.json', checksum: '7777777777777777777777777777777'},
  ]

  /**
   * Explicitly defining the type of 'readFile' as it returns either
   * 'Promise<string>' or 'Promise<Buffer>', which are ambiguous to the
   * TypeScript language server.
   */
  const readFileFn = readFile as (path: string, options?: ReadOptions) => Promise<string>

  beforeEach(() => {
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(readFileFn).mockResolvedValue('')
  })

  describe('getPatternsFromShopifyIgnore', () => {
    test('returns an empty array when the .shopifyignore file does not exist', async () => {
      // Given
      vi.mocked(fileExists).mockResolvedValue(false)
      await expect(getPatternsFromShopifyIgnore('tmp')).resolves.toEqual([])
    })

    test('returns an empty array when the .shopifyignore file does not exist', async () => {
      vi.mocked(fileExists).mockResolvedValue(true)
      vi.mocked(readFileFn).mockResolvedValue(`
        # assets/basic.css
        assets/complex.css
        assets/*.png
        sections/*
        templates/*
        config/*_data.json
        .*settings_schema.json
      `)

      await expect(getPatternsFromShopifyIgnore('tmp')).resolves.toEqual([
        'assets/complex.css',
        'assets/*.png',
        'sections/*',
        'templates/*',
        'config/*_data.json',
        '.*settings_schema.json',
      ])

      expect(readFileFn).toHaveBeenLastCalledWith('tmp/.shopifyignore', {encoding: 'utf8'})
    })
  })

  describe('applyIgnoreFilters', () => {
    test(`returns entire list of checksums when there's no filter to apply`, async () => {
      // Given/When
      const actualChecksums = applyIgnoreFilters(checksums, {})

      // Then
      expect(actualChecksums).toEqual(checksums)
    })

    test(`returns the proper checksums ignoring files specified by the '.shopifyignore' file`, async () => {
      // Given
      const options = {
        ignoreFromFile: [
          'assets/complex.css',
          'assets/*.png',
          'sections/*',
          'templates/*',
          'config/*_data.json',
          '/settings_schema/',
        ],
      }

      // When
      const actualChecksums = applyIgnoreFilters(checksums, options)

      // Then
      expect(actualChecksums).toEqual([{key: 'assets/basic.css', checksum: '00000000000000000000000000000000'}])
    })

    test(`returns the proper checksums ignoring files specified by the 'ignore' option`, async () => {
      // Given
      const options = {ignore: ['config/*', 'templates/*', 'assets/image.png']}

      // When
      const actualChecksums = applyIgnoreFilters(checksums, options)

      // Then
      expect(actualChecksums).toEqual([
        {key: 'assets/basic.css', checksum: '00000000000000000000000000000000'},
        {key: 'assets/complex.css', checksum: '11111111111111111111111111111111'},
        {key: 'sections/announcement-bar.liquid', checksum: '55555555555555555555555555555555'},
      ])
    })

    test(`returns the proper checksums ignoring files specified by the 'only' option`, async () => {
      // Given
      const options = {only: ['config/*', 'assets/image.png']}

      // When
      const actualChecksums = applyIgnoreFilters(checksums, options)

      // Then
      expect(actualChecksums).toEqual([
        {key: 'assets/image.png', checksum: '22222222222222222222222222222222'},
        {key: 'config/settings_data.json', checksum: '33333333333333333333333333333333'},
        {key: 'config/settings_schema.json', checksum: '44444444444444444444444444444444'},
      ])
    })

    test(`doesn't throws an error when invalid regexes are passed`, async () => {
      // Given
      const options = {ignore: ['*.css']}

      // When
      const actualChecksums = applyIgnoreFilters(checksums, options)

      // Then
      expect(actualChecksums).toEqual([
        {key: 'assets/image.png', checksum: '22222222222222222222222222222222'},
        {key: 'config/settings_data.json', checksum: '33333333333333333333333333333333'},
        {key: 'config/settings_schema.json', checksum: '44444444444444444444444444444444'},
        {key: 'sections/announcement-bar.liquid', checksum: '55555555555555555555555555555555'},
        {key: 'templates/404.json', checksum: '6666666666666666666666666666666'},
        {key: 'templates/customers/account.json', checksum: '7777777777777777777777777777777'},
      ])
    })

    test(`matching is backward compatible with Shopify CLI 2 with the templates/*.json pattern`, async () => {
      // Given
      const options = {only: ['templates/*.json']}

      // When
      const actualChecksums = applyIgnoreFilters(checksums, options)

      // Then
      expect(actualChecksums).toEqual([
        {key: 'templates/404.json', checksum: '6666666666666666666666666666666'},
        {key: 'templates/customers/account.json', checksum: '7777777777777777777777777777777'},
      ])
    })

    test(`matching is backward compatible with Shopify CLI 2 with the templates/**/*.json pattern`, async () => {
      // Given
      const options = {only: ['templates/**/*.json']}

      // When
      const actualChecksums = applyIgnoreFilters(checksums, options)

      // Then
      expect(actualChecksums).toEqual([
        {key: 'templates/customers/account.json', checksum: '7777777777777777777777777777777'},
      ])
    })
  })

  describe('applyIgnoreFilters with negated patterns', () => {
    test(`only negating a file does not produce side effects of other ignored files`, () => {
      const options = {
        ignoreFromFile: ['!assets/basic.css'],
      }

      const actualChecksums = applyIgnoreFilters(checksums, options)

      expect(actualChecksums).toEqual([
        {key: 'assets/basic.css', checksum: '00000000000000000000000000000000'},
        {key: 'assets/complex.css', checksum: '11111111111111111111111111111111'},
        {key: 'assets/image.png', checksum: '22222222222222222222222222222222'},
        {key: 'config/settings_data.json', checksum: '33333333333333333333333333333333'},
        {key: 'config/settings_schema.json', checksum: '44444444444444444444444444444444'},
        {key: 'sections/announcement-bar.liquid', checksum: '55555555555555555555555555555555'},
        {key: 'templates/404.json', checksum: '6666666666666666666666666666666'},
        {key: 'templates/customers/account.json', checksum: '7777777777777777777777777777777'},
      ])
    })
    test(`negating a specific file overrides ignoring one`, () => {
      // Given
      const options = {
        ignoreFromFile: ['assets/*.css', '!assets/basic.css'],
      }

      // When
      const actualChecksums = applyIgnoreFilters(checksums, options)

      // Then
      expect(actualChecksums).toEqual([
        {key: 'assets/image.png', checksum: '22222222222222222222222222222222'},
        {key: 'config/settings_data.json', checksum: '33333333333333333333333333333333'},
        {key: 'config/settings_schema.json', checksum: '44444444444444444444444444444444'},
        {key: 'sections/announcement-bar.liquid', checksum: '55555555555555555555555555555555'},
        {key: 'templates/404.json', checksum: '6666666666666666666666666666666'},
        {key: 'templates/customers/account.json', checksum: '7777777777777777777777777777777'},
        {key: 'assets/basic.css', checksum: '00000000000000000000000000000000'},
      ])
    })

    test('should not ignore files matching a negated pattern', () => {
      const ignorePatterns = [
        'assets/basic.css',
        'sections/*.json',
        'templates/*.json',
        'templates/**/*.json',
        'config/*.json',
        '!config/*_schema.json',
      ]

      const actualChecksums = applyIgnoreFilters(checksums, {ignoreFromFile: ignorePatterns})

      expect(actualChecksums).toEqual([
        {key: 'assets/complex.css', checksum: '11111111111111111111111111111111'},
        {key: 'assets/image.png', checksum: '22222222222222222222222222222222'},
        {key: 'sections/announcement-bar.liquid', checksum: '55555555555555555555555555555555'},
        {key: 'config/settings_schema.json', checksum: '44444444444444444444444444444444'},
      ])
    })
  })
  describe('applyIgnoreFilters with negated ignore and only options', () => {
    test(`negating a specific file in ignore option overrides ignoring one`, () => {
      const options = {
        ignore: ['assets/*.css', '!assets/basic.css'],
      }

      const actualChecksums = applyIgnoreFilters(checksums, options)

      expect(actualChecksums).toEqual([
        {key: 'assets/image.png', checksum: '22222222222222222222222222222222'},
        {key: 'config/settings_data.json', checksum: '33333333333333333333333333333333'},
        {key: 'config/settings_schema.json', checksum: '44444444444444444444444444444444'},
        {key: 'sections/announcement-bar.liquid', checksum: '55555555555555555555555555555555'},
        {key: 'templates/404.json', checksum: '6666666666666666666666666666666'},
        {key: 'templates/customers/account.json', checksum: '7777777777777777777777777777777'},
        {key: 'assets/basic.css', checksum: '00000000000000000000000000000000'},
      ])
    })

    test(`negating a specific file in only option properly overrides and ignores it`, () => {
      const options = {
        only: ['assets/*.css', '!assets/basic.css'],
      }

      const actualChecksums = applyIgnoreFilters(checksums, options)

      expect(actualChecksums).toEqual([{key: 'assets/complex.css', checksum: '11111111111111111111111111111111'}])
    })
  })
  describe('applyIgnoreFilters do not return duplicates', () => {
    test(`should not return duplicates when negated patterns are used`, () => {
      const options = {
        ignoreFromFile: ['assets/*.css', '!assets/basic.css'],
        ignore: ['!assets/basic.css'],
      }

      const actualChecksums = applyIgnoreFilters(checksums, options)

      expect(actualChecksums).toEqual([
        {key: 'assets/image.png', checksum: '22222222222222222222222222222222'},
        {key: 'config/settings_data.json', checksum: '33333333333333333333333333333333'},
        {key: 'config/settings_schema.json', checksum: '44444444444444444444444444444444'},
        {key: 'sections/announcement-bar.liquid', checksum: '55555555555555555555555555555555'},
        {key: 'templates/404.json', checksum: '6666666666666666666666666666666'},
        {key: 'templates/customers/account.json', checksum: '7777777777777777777777777777777'},
        {key: 'assets/basic.css', checksum: '00000000000000000000000000000000'},
      ])
    })
  })
  describe('applyIgnoreFilters with only options', () => {
    test(`should return single file when only option is a single file`, () => {
      const options = {
        only: ['assets/basic.css'],
      }

      const actualChecksums = applyIgnoreFilters(checksums, options)

      expect(actualChecksums).toEqual([{key: 'assets/basic.css', checksum: '00000000000000000000000000000000'}])
    })

    test(`should return all files in a directory matching the pattern`, () => {
      const options = {
        only: ['assets/*.css'],
      }

      const actualChecksums = applyIgnoreFilters(checksums, options)

      expect(actualChecksums).toEqual([
        {key: 'assets/basic.css', checksum: '00000000000000000000000000000000'},
        {key: 'assets/complex.css', checksum: '11111111111111111111111111111111'},
      ])
    })

    test(`should return all files in a directory when using proper glob pattern`, () => {
      const options = {
        only: ['templates/*'],
      }

      const actualChecksums = applyIgnoreFilters(checksums, options)

      expect(actualChecksums).toEqual([
        {key: 'templates/404.json', checksum: '6666666666666666666666666666666'},
        {key: 'templates/customers/account.json', checksum: '7777777777777777777777777777777'},
      ])
    })
  })

  describe('applyIgnoreFilters with ignore options', () => {
    test(`should ignore single file when ignore option is a single file`, () => {
      const options = {
        ignore: ['assets/basic.css'],
      }

      const actualChecksums = applyIgnoreFilters(checksums, options)

      expect(actualChecksums).toEqual([
        {key: 'assets/complex.css', checksum: '11111111111111111111111111111111'},
        {key: 'assets/image.png', checksum: '22222222222222222222222222222222'},
        {key: 'config/settings_data.json', checksum: '33333333333333333333333333333333'},
        {key: 'config/settings_schema.json', checksum: '44444444444444444444444444444444'},
        {key: 'sections/announcement-bar.liquid', checksum: '55555555555555555555555555555555'},
        {key: 'templates/404.json', checksum: '6666666666666666666666666666666'},
        {key: 'templates/customers/account.json', checksum: '7777777777777777777777777777777'},
      ])
    })

    test(`should ignore all files in a directory matching the pattern`, () => {
      const options = {
        ignore: ['assets/*.css'],
      }

      const actualChecksums = applyIgnoreFilters(checksums, options)

      expect(actualChecksums).toEqual([
        {key: 'assets/image.png', checksum: '22222222222222222222222222222222'},
        {key: 'config/settings_data.json', checksum: '33333333333333333333333333333333'},
        {key: 'config/settings_schema.json', checksum: '44444444444444444444444444444444'},
        {key: 'sections/announcement-bar.liquid', checksum: '55555555555555555555555555555555'},
        {key: 'templates/404.json', checksum: '6666666666666666666666666666666'},
        {key: 'templates/customers/account.json', checksum: '7777777777777777777777777777777'},
      ])
    })

    test(`should ignore all files in a directory when using proper glob pattern`, () => {
      const options = {
        ignore: ['assets/*'],
      }

      const actualChecksums = applyIgnoreFilters(checksums, options)

      expect(actualChecksums).toEqual([
        {key: 'config/settings_data.json', checksum: '33333333333333333333333333333333'},
        {key: 'config/settings_schema.json', checksum: '44444444444444444444444444444444'},
        {key: 'sections/announcement-bar.liquid', checksum: '55555555555555555555555555555555'},
        {key: 'templates/404.json', checksum: '6666666666666666666666666666666'},
        {key: 'templates/customers/account.json', checksum: '7777777777777777777777777777777'},
      ])
    })
  })
  describe('pattern warnings', () => {
    test('should warn when a pattern ends with a slash', () => {
      const options = {
        ignore: ['assets/'],
      }

      applyIgnoreFilters(checksums, options)

      expect(renderWarning).toHaveBeenCalledWith({
        headline: 'Directory pattern may be misleading.',
        body: 'For more reliable matching, consider using assets/* or assets/*.filename instead.',
      })
    })
  })
})
