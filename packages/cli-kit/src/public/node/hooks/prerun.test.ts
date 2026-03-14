import {parseCommandContent, warnOnAvailableUpgrade, interceptProcessExit, extractStoreMetadata} from './prerun.js'
import {checkForCachedNewVersion, packageManagerFromUserAgent} from '../node-package-manager.js'
import {cacheClear} from '../../../private/node/conf-store.js'
import {mockAndCaptureOutput} from '../testing/output.js'
import {reportAnalyticsEvent} from '../analytics.js'
import {postRunHookHasCompleted} from './postrun.js'
import * as metadata from '../metadata.js'

import {describe, expect, test, vi, afterEach, beforeEach} from 'vitest'

vi.mock('../node-package-manager')
vi.mock('../analytics.js')
vi.mock('./postrun.js')

beforeEach(() => {
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

describe('interceptProcessExit', () => {
  let originalExit: typeof process.exit

  beforeEach(() => {
    originalExit = process.exit
  })

  afterEach(() => {
    process.exit = originalExit
  })

  test('reports analytics with ok when process.exit(0) is called and postrun has not completed', async () => {
    vi.mocked(postRunHookHasCompleted).mockReturnValue(false)
    vi.mocked(reportAnalyticsEvent).mockResolvedValue()

    const exitSpy = vi.fn() as any
    process.exit = exitSpy
    const mockConfig = {} as any
    interceptProcessExit(mockConfig)

    ;(process.exit as Function)(0)
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalled())

    expect(reportAnalyticsEvent).toHaveBeenCalledWith({config: mockConfig, exitMode: 'ok'})
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  test('reports analytics with unexpected_error when process.exit(1) is called', async () => {
    vi.mocked(postRunHookHasCompleted).mockReturnValue(false)
    vi.mocked(reportAnalyticsEvent).mockResolvedValue()

    const exitSpy = vi.fn() as any
    process.exit = exitSpy
    const mockConfig = {} as any
    interceptProcessExit(mockConfig)

    ;(process.exit as Function)(1)
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalled())

    expect(reportAnalyticsEvent).toHaveBeenCalledWith({config: mockConfig, exitMode: 'unexpected_error'})
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  test('skips analytics when postrun hook has already completed', async () => {
    vi.mocked(postRunHookHasCompleted).mockReturnValue(true)
    vi.mocked(reportAnalyticsEvent).mockResolvedValue()

    const exitSpy = vi.fn() as any
    process.exit = exitSpy
    const mockConfig = {} as any
    interceptProcessExit(mockConfig)

    ;(process.exit as Function)(0)

    expect(reportAnalyticsEvent).not.toHaveBeenCalled()
    expect(exitSpy).toHaveBeenCalledWith(0)
  })
})

describe('extractStoreMetadata', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('extracts store from --shop flag', async () => {
    const addPublicSpy = vi.spyOn(metadata, 'addPublicMetadata')
    const addSensitiveSpy = vi.spyOn(metadata, 'addSensitiveMetadata')

    await extractStoreMetadata(['--shop', 'my-store.myshopify.com'])

    expect(addPublicSpy).toHaveBeenCalled()
    const publicResult = await addPublicSpy.mock.calls[0]![0]()
    expect(publicResult).toHaveProperty('store_fqdn_hash')

    expect(addSensitiveSpy).toHaveBeenCalled()
    const sensitiveResult = await addSensitiveSpy.mock.calls[0]![0]()
    expect(sensitiveResult).toEqual({store_fqdn: 'my-store.myshopify.com'})
  })

  test('extracts store from -s flag', async () => {
    const addSensitiveSpy = vi.spyOn(metadata, 'addSensitiveMetadata')

    await extractStoreMetadata(['-s', 'my-store.myshopify.com'])

    expect(addSensitiveSpy).toHaveBeenCalled()
    const sensitiveResult = await addSensitiveSpy.mock.calls[0]![0]()
    expect(sensitiveResult).toEqual({store_fqdn: 'my-store.myshopify.com'})
  })

  test('extracts store from --shop= syntax', async () => {
    const addSensitiveSpy = vi.spyOn(metadata, 'addSensitiveMetadata')

    await extractStoreMetadata(['--shop=my-store.myshopify.com'])

    expect(addSensitiveSpy).toHaveBeenCalled()
    const sensitiveResult = await addSensitiveSpy.mock.calls[0]![0]()
    expect(sensitiveResult).toEqual({store_fqdn: 'my-store.myshopify.com'})
  })

  test('extracts store from SHOPIFY_SHOP env var', async () => {
    const originalEnv = process.env.SHOPIFY_SHOP
    process.env.SHOPIFY_SHOP = 'env-store.myshopify.com'

    const addSensitiveSpy = vi.spyOn(metadata, 'addSensitiveMetadata')

    await extractStoreMetadata([])

    expect(addSensitiveSpy).toHaveBeenCalled()
    const sensitiveResult = await addSensitiveSpy.mock.calls[0]![0]()
    expect(sensitiveResult).toEqual({store_fqdn: 'env-store.myshopify.com'})

    process.env.SHOPIFY_SHOP = originalEnv
  })

  test('does nothing when no store is provided', async () => {
    const originalEnv = process.env.SHOPIFY_SHOP
    delete process.env.SHOPIFY_SHOP

    const addPublicSpy = vi.spyOn(metadata, 'addPublicMetadata')
    const addSensitiveSpy = vi.spyOn(metadata, 'addSensitiveMetadata')

    await extractStoreMetadata([])

    expect(addPublicSpy).not.toHaveBeenCalled()
    expect(addSensitiveSpy).not.toHaveBeenCalled()

    process.env.SHOPIFY_SHOP = originalEnv
  })
})
