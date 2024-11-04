import {parseCommandContent, warnOnAvailableUpgrade, autoUpdateCli} from './prerun.js'
import {checkForCachedNewVersion, packageManagerFromUserAgent} from '../node-package-manager.js'
import {cacheClear} from '../../../private/node/conf-store.js'
import {mockAndCaptureOutput} from '../testing/output.js'
import {autoUpdatesEnabled, isUnitTest} from '../context/local.js'
import {exec} from '../system.js'
import {currentProcessIsGlobal} from '../is-global.js'
import {describe, expect, test, vi, afterEach, beforeEach} from 'vitest'

vi.mock('../node-package-manager', async (importOriginal) => {
  const original = await importOriginal<typeof import('../node-package-manager.js')>()
  return {
    checkForNewVersion: vi.fn(),
    checkForCachedNewVersion: vi.fn(),
    packageManagerFromUserAgent: vi.fn(),
    safeToAutoUpgrade: original.safeToAutoUpgrade,
  }
})

vi.mock('../context/local')
vi.mock('../system')
vi.mock('../is-global')

beforeEach(() => {
  vi.mocked(isUnitTest).mockReturnValue(true)
  cacheClear()
})

afterEach(() => {
  mockAndCaptureOutput().clear()
  cacheClear()
})

describe('warnOnAvailableUpgrade', () => {
  test('displays latest version and an install command when a newer exists', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(checkForCachedNewVersion).mockReturnValue('3.0.10')
    vi.mocked(packageManagerFromUserAgent).mockReturnValue('npm')
    const installReminder = '💡 Version 3.0.10 available! Run `npm install @shopify/cli@latest`'

    // When
    await warnOnAvailableUpgrade()

    // Then
    expect(outputMock.warn()).toMatch(installReminder)
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

describe('autoUpdateCli', () => {
  test('does not upgrade if auto updates are disabled', async () => {
    // Given
    vi.mocked(autoUpdatesEnabled).mockReturnValue(false)

    // When
    await autoUpdateCli('3.70.0', '3.70.2')

    // Then
    expect(exec).not.toHaveBeenCalled()
  })

  test('does not upgrade if jumping a major version', async () => {
    // Given
    vi.mocked(autoUpdatesEnabled).mockReturnValue(true)

    // When
    await autoUpdateCli('3.70.0', '4.0.0')

    // Then
    expect(exec).not.toHaveBeenCalled()
  })

  test('does not upgrade if running a pinned local CLI version', async () => {
    // Given
    vi.mocked(autoUpdatesEnabled).mockReturnValue(true)
    vi.mocked(currentProcessIsGlobal).mockReturnValue(false)

    // When
    await autoUpdateCli('3.70.0', '3.70.2')

    // Then
    expect(exec).not.toHaveBeenCalled()
  })

  test('upgrades if auto updates are enabled and the version is not pinned', async () => {
    // Given
    vi.mocked(autoUpdatesEnabled).mockReturnValue(true)
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(packageManagerFromUserAgent).mockReturnValue('npm')

    // When
    await autoUpdateCli('3.70.0', '3.70.2')

    // Then
    expect(exec).toHaveBeenCalledWith('npm', ['install', '-g', '@shopify/cli@latest'], {detached: true, unref: true})
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
