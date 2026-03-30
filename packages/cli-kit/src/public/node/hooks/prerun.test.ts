import {parseCommandContent, checkForNewVersionInBackground} from './prerun.js'
import {checkForNewVersion} from '../node-package-manager.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../node-package-manager')

describe('checkForNewVersionInBackground', () => {
  test('calls checkForNewVersion for stable versions', () => {
    vi.mocked(checkForNewVersion).mockResolvedValue(undefined)

    checkForNewVersionInBackground()

    expect(checkForNewVersion).toHaveBeenCalledWith('@shopify/cli', expect.any(String), {cacheExpiryInHours: 24})
  })

  test('skips check for pre-release versions', () => {
    vi.stubEnv('SHOPIFY_CLI_VERSION', '0.0.0-snapshot-abc')

    // Create a fresh module environment with stubbed version
    vi.doMock('../../common/version.js', () => ({CLI_KIT_VERSION: '0.0.0-snapshot-abc'}))

    checkForNewVersionInBackground()

    vi.unstubAllEnvs()
    vi.doUnmock('../../common/version.js')
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
