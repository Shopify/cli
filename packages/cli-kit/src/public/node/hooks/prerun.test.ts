import {parseCommandContent, warnOnAvailableUpgrade} from './prerun.js'
import {packageManagerFromUserAgent, checkForCachedNewVersion} from '../node-package-manager.js'
import {cacheClear} from '../../../private/node/conf-store.js'
import {mockAndCaptureOutput} from '../testing/output.js'
import {describe, expect, test, vi, afterEach, beforeEach} from 'vitest'

vi.mock('../node-package-manager')

beforeEach(() => {
  cacheClear()
})

afterEach(() => {
  mockAndCaptureOutput().clear()
  cacheClear()
})

describe('warnOnAvailableUpgrade', () => {
  test('displays latest version and yarn upgrade message when a newer exists', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(checkForCachedNewVersion).mockReturnValue('3.0.10')
    vi.mocked(packageManagerFromUserAgent).mockReturnValue('yarn')

    // When
    await warnOnAvailableUpgrade()

    // Then
    expect(outputMock.warn()).toMatchInlineSnapshot(`
        "💡 Version 3.0.10 available! Run \`yarn shopify upgrade\`"
      `)
  })

  test('displays latest version and pnpm upgrade message when a newer exists', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(checkForCachedNewVersion).mockReturnValue('3.0.10')
    vi.mocked(packageManagerFromUserAgent).mockReturnValue('pnpm')

    // When
    await warnOnAvailableUpgrade()

    // Then
    expect(outputMock.warn()).toMatchInlineSnapshot(`
        "💡 Version 3.0.10 available! Run \`pnpm shopify upgrade\`"
      `)
  })

  test('displays latest version and npm upgrade message when a newer exists', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(checkForCachedNewVersion).mockReturnValue('3.0.10')
    vi.mocked(packageManagerFromUserAgent).mockReturnValue('npm')

    // When
    await warnOnAvailableUpgrade()

    // Then
    expect(outputMock.warn()).toMatchInlineSnapshot(`
        "💡 Version 3.0.10 available! Run \`npm run shopify upgrade\`"
      `)
  })

  test('displays nothing when no newer version exists', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(checkForCachedNewVersion).mockReturnValue(undefined)

    // When
    await warnOnAvailableUpgrade()

    // Then
    expect(outputMock.warn()).toEqual('')
  })
})

describe('parseCommandContent', () => {
  test('when a create command is used should return the correct command content', async () => {
    // Given
    const cmdInfo = {
      id: 'init',
      aliases: [],
      pluginAlias: '@shopify/create-app',
    }

    // When
    const got = parseCommandContent(cmdInfo)

    // Then
    expect(got).not.toBeUndefined()
    expect(got.command).toBe('create-app')
    expect(got.topic).toBeUndefined()
    expect(got.alias).toBeUndefined()
  })

  test('when a normal command is used without topic should return the correct command content', async () => {
    // Given
    const cmdInfo = {
      id: 'upgrade',
      aliases: [],
      pluginAlias: '@shopify/cli',
    }

    // When
    const got = parseCommandContent(cmdInfo)

    // Then
    expect(got).not.toBeUndefined()
    expect(got.command).toBe('upgrade')
    expect(got.topic).toBeUndefined()
    expect(got.alias).toBeUndefined()
  })

  test('when a normal command is with topic should return the correct command content', async () => {
    // Given
    const cmdInfo = {
      id: 'app:dev',
      aliases: [],
      pluginAlias: '@shopify/cli',
    }

    // When
    const got = parseCommandContent(cmdInfo)

    // Then
    expect(got).not.toBeUndefined()
    expect(got.command).toBe('app dev')
    expect(got.topic).toBe('app')
    expect(got.alias).toBeUndefined()
  })

  test('when a normal command is with alias should return the correct command content', async () => {
    // Given
    const cmdInfo = {
      id: 'upgrade',
      aliases: ['upgradeAlias'],
      pluginAlias: '@shopify/cli',
    }
    process.argv = ['upgradeAlias']

    // When
    const got = parseCommandContent(cmdInfo)

    // Then
    expect(got).not.toBeUndefined()
    expect(got.command).toBe('upgrade')
    expect(got.topic).toBeUndefined()
    expect(got.alias).toBe('upgradeAlias')
  })
})
