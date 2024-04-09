import {applyIgnoreFilters} from './asset-ignore.js'
import {ReadOptions, fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import {test, describe, beforeEach, vi, expect} from 'vitest'

vi.mock('@shopify/cli-kit/node/fs', async () => {
  const originalFs: any = await vi.importActual('@shopify/cli-kit/node/fs')
  return {
    ...originalFs,
    matchGlob: originalFs.matchGlob,
    readFile: vi.fn(),
    fileExists: vi.fn(),
  }
})

vi.mock('@shopify/cli-kit/node/path')
vi.mock('@shopify/cli-kit/node/output')

describe('applyIgnoreFilters', () => {
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
  const themeFileSystem = {root: '/tmp/', files: new Map()}

  /**
   * Explicitly defining the type of 'readFile' as it returns either
   * 'Promise<string>' or 'Promise<Buffer>', which are ambiguous to the
   * TypeScript language server.
   */
  const readFileFn = readFile as (path: string, options?: ReadOptions) => Promise<string>

  beforeEach(() => {
    vi.mocked(joinPath).mockReturnValue('.shopifyignore')
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(readFileFn).mockResolvedValue('')
  })

  test(`returns entire list of checksums when there's no filter to apply`, async () => {
    // Given/When
    const actualChecksums = await applyIgnoreFilters(checksums, themeFileSystem)

    // Then
    expect(actualChecksums).toEqual(checksums)
  })

  test(`returns the proper checksums ignoring files specified by the '.shopifyignore' file`, async () => {
    // Given
    vi.mocked(readFileFn).mockResolvedValue(`
      # assets/basic.css
      assets/complex.css
      assets/*.png
      sections/*
      templates/*
      config/*_data.json
      .*settings_schema.json
    `)

    // When
    const actualChecksums = await applyIgnoreFilters(checksums, themeFileSystem)

    // Then
    expect(actualChecksums).toEqual([{key: 'assets/basic.css', checksum: '00000000000000000000000000000000'}])
  })

  test(`returns the proper checksums ignoring files specified by the 'ignore' option`, async () => {
    // Given
    const options = {ignore: ['config/*', 'templates/*', 'assets/image.png']}

    // When
    const actualChecksums = await applyIgnoreFilters(checksums, themeFileSystem, options)

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
    const actualChecksums = await applyIgnoreFilters(checksums, themeFileSystem, options)

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
    const actualChecksums = await applyIgnoreFilters(checksums, themeFileSystem, options)

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

  test(`matching is backward compatible with Shopify CLI 2`, async () => {
    // Given
    const options = {only: ['templates/*.json']}

    // When
    const actualChecksums = await applyIgnoreFilters(checksums, themeFileSystem, options)

    // Then
    expect(actualChecksums).toEqual([
      {key: 'templates/404.json', checksum: '6666666666666666666666666666666'},
      {key: 'templates/customers/account.json', checksum: '7777777777777777777777777777777'},
    ])
  })

  test(`only outputs glob pattern subdirectory warnings for the templates folder`, async () => {
    // Given
    const options = {only: ['assets/*.json', 'config/*.json', 'sections/*.json']}
    // When
    await applyIgnoreFilters(checksums, themeFileSystem, options)
    // Then
    expect(vi.mocked(outputWarn)).not.toHaveBeenCalled()
  })

  test(`outputs warnings when there are glob pattern modifications required for subdirectories`, async () => {
    // Given
    const options = {only: ['templates/*.json']}

    // When
    await applyIgnoreFilters(checksums, themeFileSystem, options)

    // Then
    expect(vi.mocked(outputWarn)).toHaveBeenCalledTimes(1)
  })

  test('only outputs a single warning for duplicated glob patterns', async () => {
    // Given
    const options = {only: ['templates/*.json'], ignore: ['templates/*.json']}

    // When
    await applyIgnoreFilters(checksums, themeFileSystem, options)

    // Then
    expect(vi.mocked(outputWarn)).toHaveBeenCalledTimes(1)
  })
})
