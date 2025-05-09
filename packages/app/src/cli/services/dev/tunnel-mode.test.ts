import {AutoTunnel, CustomTunnel, getTunnelMode, NoTunnel} from './tunnel-mode.js'
import {ports} from '../../constants.js'
import {checkPortAvailability, getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {test, expect, describe, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/tcp')
vi.mock('../../utilities/mkcert.js')

describe('getTunnelMode() if tunnelUrl is defined', () => {
  test('returns AutoTunnel', async () => {
    // Given
    const defaultOptions = {
      useLocalhost: false,
      localhostPort: undefined,
      tunnelUrl: undefined,
    }

    // When
    const result = (await getTunnelMode(defaultOptions)) as AutoTunnel

    // Then
    expect(result).toMatchObject({mode: 'auto'})
  })
})

describe('getTunnelMode() if useLocalhost is false and tunnelUrl is a string', () => {
  test('returns CustomTunnel', async () => {
    // Given
    const defaultOptions = {
      useLocalhost: false,
      localhostPort: undefined,
      tunnelUrl: 'https://my-tunnel-url.com',
    }

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
      requestedPort: localhostPort,
      actualPort: localhostPort,
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
      actualPort: ports.localhost,
      requestedPort: ports.localhost,
    })
  })

  test('actualPort and requestedPort differ if ports.localhost is not available', async () => {
    // Given
    const availablePort = ports.localhost + 1
    vi.mocked(checkPortAvailability).mockResolvedValue(false)
    vi.mocked(getAvailableTCPPort).mockResolvedValue(ports.localhost + 1)

    // When
    const result = (await getTunnelMode(defaultOptions)) as NoTunnel

    // Then
    expect(result).toMatchObject({
      mode: 'use-localhost',
      actualPort: availablePort,
      requestedPort: ports.localhost,
    })
  })
})
