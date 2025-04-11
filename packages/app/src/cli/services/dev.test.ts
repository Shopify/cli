import {
  AutoTunnel,
  CustomTunnel,
  developerPreviewController,
  getTunnelMode,
  NoTunnel,
  warnIfScopesDifferBeforeDev,
} from './dev.js'
import {fetchAppPreviewMode} from './dev/fetch.js'
import {testAppLinked, testDeveloperPlatformClient, testOrganizationApp} from '../models/app/app.test-data.js'
import {generateCertificate} from '../utilities/mkcert.js'
import {ports} from '../constants.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {checkPortAvailability, getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'

vi.mock('./dev/fetch.js')
vi.mock('@shopify/cli-kit/node/tcp')
vi.mock('../utilities/mkcert.js')

describe('developerPreviewController', () => {
  test('does not refresh the tokens when they are still valid', async () => {
    // Given
    const developerPlatformClient = testDeveloperPlatformClient()
    const controller = developerPreviewController('apiKey', developerPlatformClient)
    vi.mocked(fetchAppPreviewMode).mockResolvedValueOnce(true)

    // When
    const got = await controller.fetchMode()

    // Then
    expect(got).toBe(true)
    expect(developerPlatformClient.refreshToken).not.toHaveBeenCalled()
  })
  test('refreshes the tokens when they expire', async () => {
    // Given
    const developerPlatformClient = testDeveloperPlatformClient()
    const controller = developerPreviewController('apiKey', developerPlatformClient)
    vi.mocked(fetchAppPreviewMode).mockRejectedValueOnce(new Error('expired token'))
    vi.mocked(fetchAppPreviewMode).mockResolvedValueOnce(true)

    // When
    const got = await controller.fetchMode()

    // Then
    expect(got).toBe(true)
    expect(developerPlatformClient.refreshToken).toHaveBeenCalledOnce()
    expect(fetchAppPreviewMode).toHaveBeenCalledTimes(2)
  })
})

describe('warnIfScopesDifferBeforeDev', () => {
  const appsWithScopes = (local: string, remote: string) => {
    const localApp = testAppLinked({})
    const remoteApp = testOrganizationApp()
    localApp.configuration = {
      ...localApp.configuration,
      access_scopes: {scopes: local, use_legacy_install_flow: false},
    }
    remoteApp.configuration = {
      ...remoteApp.configuration,
      access_scopes: {scopes: remote, use_legacy_install_flow: false},
    } as any
    return {
      localApp,
      remoteApp,
    }
  }

  test('does not warn if the scopes are the same', async () => {
    // Given
    const developerPlatformClient = testDeveloperPlatformClient({supportsDevSessions: false})
    const apps = appsWithScopes('scopes1,scopes2', 'scopes1,scopes2')

    // When
    const mockOutput = mockAndCaptureOutput()
    mockOutput.clear()
    await warnIfScopesDifferBeforeDev({...apps, developerPlatformClient})

    // Then
    expect(mockOutput.warn()).toBe('')
  })

  test('warns if the scopes differ', async () => {
    // Given
    const apps = appsWithScopes('scopes1,scopes2', 'scopes3,scopes4')
    const developerPlatformClient = testDeveloperPlatformClient({supportsDevSessions: false})

    // When
    const mockOutput = mockAndCaptureOutput()
    mockOutput.clear()
    await warnIfScopesDifferBeforeDev({...apps, developerPlatformClient})

    // Then
    expect(mockOutput.warn()).toContain("The scopes in your TOML don't match")
  })

  test('silent if scopes differ cosmetically', async () => {
    // Given
    const apps = appsWithScopes('scopes1,      scopes2 ', '  scopes2,     scopes1')
    const developerPlatformClient = testDeveloperPlatformClient({supportsDevSessions: false})

    // When
    const mockOutput = mockAndCaptureOutput()
    mockOutput.clear()
    await warnIfScopesDifferBeforeDev({...apps, developerPlatformClient})

    // Then
    expect(mockOutput.warn()).toBe('')
  })
})

describe('getTunnelMode() if tunnelUrl is defined', () => {
  const defaultOptions = {
    useLocalhost: false,
    localhostPort: undefined,
    tunnelUrl: undefined,
  }

  test('returns AutoTunnel', async () => {
    // Given
    const localhostPort = 1234
    vi.mocked(getAvailableTCPPort).mockResolvedValue(1234)

    // When
    const result = (await getTunnelMode(defaultOptions)) as AutoTunnel

    // Then
    expect(result).toMatchObject({mode: 'auto'})
  })
})

describe('getTunnelMode() if useLocalhost is false and tunnelUrl is a string', () => {
  const defaultOptions = {
    useLocalhost: false,
    localhostPort: undefined,
    tunnelUrl: 'https://my-tunnel-url.com',
  }

  test('returns CustomTunnel', async () => {
    // Given
    const localhostPort = 1234
    vi.mocked(getAvailableTCPPort).mockResolvedValue(1234)

    // When
    const result = (await getTunnelMode(defaultOptions)) as CustomTunnel

    // Then
    expect(result).toMatchObject({
      mode: 'custom',
      url: defaultOptions.tunnelUrl,
    })
  })
})

describe('getTunnelMode() if useLocalhost is true', () => {
  const mockCertificate = {
    keyContent: 'test-key-content',
    certContent: 'test-cert-content',
    certPath: '/path/to/cert',
  }

  beforeEach(() => {
    vi.mocked(generateCertificate).mockResolvedValue(mockCertificate)
  })

  const defaultOptions = {
    useLocalhost: true,
    localhostPort: undefined,
    tunnelUrl: undefined,
  }

  test('returns localhostPort when passed', async () => {
    // Given
    const localhostPort = 1234
    vi.mocked(getAvailableTCPPort).mockResolvedValue(1234)

    // When
    const result = (await getTunnelMode({
      ...defaultOptions,
      localhostPort,
    })) as NoTunnel

    // Then
    expect(getAvailableTCPPort).toHaveBeenCalledWith(localhostPort)
    expect(result).toMatchObject({
      mode: 'use-localhost',
      port: localhostPort,
      provideCertificate: expect.any(Function),
    })
  })

  test('throws when localhostPort is passed, but not available', async () => {
    // Given
    const localhostPort = 1234
    vi.mocked(getAvailableTCPPort).mockResolvedValue(4321)

    // Then
    await expect(
      getTunnelMode({
        ...defaultOptions,
        localhostPort,
      }),
    ).rejects.toThrow()
  })

  test('returns ports.localhost when localhostPort is not passed', async () => {
    // Given
    vi.mocked(getAvailableTCPPort).mockResolvedValue(ports.localhost)

    // When
    const result = (await getTunnelMode(defaultOptions)) as NoTunnel

    // Then
    expect(getAvailableTCPPort).toHaveBeenCalledWith(ports.localhost)
    expect(result).toMatchObject({
      mode: 'use-localhost',
      port: ports.localhost,
      provideCertificate: expect.any(Function),
    })
  })

  describe('provideCertificate()', () => {
    test('Calls renderInfo', async () => {
      // Given
      vi.mocked(checkPortAvailability).mockResolvedValue(true)

      // When
      const mockOutput = mockAndCaptureOutput()
      mockOutput.clear()
      const result = (await getTunnelMode(defaultOptions)) as NoTunnel
      await result.provideCertificate('app-directory')

      // Then
      expect(mockOutput.info()).toContain('Localhost-based development is in developer preview')
    })

    test('Renders warning if ports.localhost is not available', async () => {
      // Given
      const availablePort = ports.localhost + 1
      vi.mocked(checkPortAvailability).mockResolvedValue(false)
      vi.mocked(getAvailableTCPPort).mockResolvedValue(ports.localhost + 1)

      // When
      const mockOutput = mockAndCaptureOutput()
      mockOutput.clear()
      const result = (await getTunnelMode(defaultOptions)) as NoTunnel
      await result.provideCertificate('app-directory')

      // Then
      expect(result.port).toBe(availablePort)
      expect(mockOutput.warn()).toContain('A random port will be used for localhost')
    })

    test('Calls generateCertificate and returns its value', async () => {
      // Given
      vi.mocked(checkPortAvailability).mockResolvedValue(true)

      // When
      const mockOutput = mockAndCaptureOutput()
      mockOutput.clear()
      const result = (await getTunnelMode(defaultOptions)) as NoTunnel
      const certificate = await result.provideCertificate('app-directory')

      // Then
      expect(generateCertificate).toHaveBeenCalledWith({
        appDirectory: 'app-directory',
        onRequiresConfirmation: expect.any(Function),
      })
      expect(certificate).toEqual(mockCertificate)
    })
  })
})
