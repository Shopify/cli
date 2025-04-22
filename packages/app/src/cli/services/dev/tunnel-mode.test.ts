import {AutoTunnel, CustomTunnel, getTunnelMode, NoTunnel} from './tunnel-mode.js'
import {PortWarning} from './port-warnings.js'
import {generateCertificate} from '../../utilities/mkcert.js'
import {ports} from '../../constants.js'
import {checkPortAvailability, getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

describe('getTunnelMode() if tunnelUrl is defined', () => {
  const defaultOptions = {
    useLocalhost: false,
    localhostPort: undefined,
    tunnelUrl: undefined,
    portWarnings: [],
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
    portWarnings: [],
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
    portWarnings: [],
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

  test('Warns if ports.localhost is not available', async () => {
    // Given
    const availablePort = ports.localhost + 1
    vi.mocked(checkPortAvailability).mockResolvedValue(false)
    vi.mocked(getAvailableTCPPort).mockResolvedValue(ports.localhost + 1)
    const portWarnings: PortWarning[] = []

    // When
    const result = (await getTunnelMode({...defaultOptions, portWarnings})) as NoTunnel
    await result.provideCertificate('app-directory')

    // Then
    expect(result.port).toBe(availablePort)
    expect(portWarnings).toStrictEqual([
      {
        type: 'localhost',
        flag: '--localhost-port',
        requestedPort: ports.localhost,
      },
    ])
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
