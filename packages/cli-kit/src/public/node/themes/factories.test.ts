import {buildTheme, buildChecksum, buildThemeAsset} from './factories.js'
import {describe, test, expect} from 'vitest'

describe('buildTheme', () => {
  test('returns undefined when themeJson is undefined', () => {
    expect(buildTheme()).toBeUndefined()
  })

  test('transforms main role to live role', () => {
    const theme = buildTheme({
      id: 1,
      name: 'Main Theme',
      role: 'main',
    })

    expect(theme).toEqual({
      id: 1,
      name: 'Main Theme',
      role: 'live',
      processing: false,
      createdAtRuntime: false,
    })
  })

  test('preserves non-main roles and custom flags', () => {
    const theme = buildTheme({
      id: 2,
      name: 'Dev Theme',
      role: 'development',
      processing: true,
      createdAtRuntime: true,
    })

    expect(theme).toEqual({
      id: 2,
      name: 'Dev Theme',
      role: 'development',
      processing: true,
      createdAtRuntime: true,
    })
  })
})

describe('buildChecksum', () => {
  test('returns undefined when asset is undefined', () => {
    expect(buildChecksum()).toBeUndefined()
  })

  test('extracts key and checksum from asset', () => {
    const checksum = buildChecksum({
      key: 'assets/app.js',
      checksum: '12345',
      attachment: undefined,
      value: 'console.log("hello")',
    })

    expect(checksum).toEqual({
      key: 'assets/app.js',
      checksum: '12345',
    })
  })
})

describe('buildThemeAsset', () => {
  test('returns undefined when asset is undefined', () => {
    expect(buildThemeAsset(undefined)).toBeUndefined()
  })

  test('calculates size stats from string value', () => {
    const value = 'body { color: red; }'
    const asset = buildThemeAsset({
      key: 'assets/style.css',
      checksum: 'abc',
      attachment: undefined,
      value,
    })

    expect(asset).toEqual({
      key: 'assets/style.css',
      checksum: 'abc',
      attachment: undefined,
      value,
      stats: {
        size: value.length,
        mtime: expect.any(Number),
      },
    })
  })

  test('calculates size stats from attachment when value is empty', () => {
    const attachment = 'base64string=='
    const asset = buildThemeAsset({
      key: 'assets/logo.png',
      checksum: 'def',
      attachment,
      value: '',
    })

    expect(asset).toEqual({
      key: 'assets/logo.png',
      checksum: 'def',
      attachment,
      value: '',
      stats: {
        size: attachment.length,
        mtime: expect.any(Number),
      },
    })
  })
})
