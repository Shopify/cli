import {hookStart} from './tunnel.js'
import install from './install-cloudflared.js'
import {describe, vi, expect, test, beforeAll} from 'vitest'
import {exec} from '@shopify/cli-kit/node/system'
import {Writable} from 'stream'

const port = 1234
vi.mock('@shopify/cli-kit/node/system')
vi.mock('./install-cloudflared.js')

describe('hookStart', () => {
  beforeAll(() => {
    vi.mocked(install).mockReturnValue(Promise.resolve())
  })

  test('returns a url if cloudflare prints a URL and a connection is established', async () => {
    // Given
    vi.mocked(exec).mockImplementationOnce(async (command, args, options) => {
      const writable = options?.stdout as Writable
      writable.write(Buffer.from(`2023-01-30T15:37:11Z INF |  https://example.trycloudflare.com`))
      writable.write(Buffer.from(`2023-01-30T15:37:11Z INF Connection registered`))
    })

    // When
    const tunnelClient = await hookStart(port)
    const result = tunnelClient.valueOrAbort().getTunnelStatus()

    // Then
    expect(result).toEqual({url: 'https://example.trycloudflare.com', status: 'connected'})
  })

  test('returns a url if cloudflare prints a URL and a connection is established with a different message', async () => {
    // Given
    vi.mocked(exec).mockImplementationOnce(async (command, args, options) => {
      const writable = options?.stdout as Writable
      writable.write(Buffer.from(`2023-01-30T15:37:11Z INF |  https://example.trycloudflare.com`))
      writable.write(Buffer.from(`2023-01-30T15:37:11Z INF Registered tunnel connection`))
    })

    // When
    const tunnelClient = await hookStart(port)
    const result = tunnelClient.valueOrAbort().getTunnelStatus()

    // Then
    expect(result).toEqual({url: 'https://example.trycloudflare.com', status: 'connected'})
  })

  test('throws if a connection is stablished but we didnt find a URL', async () => {
    // Given
    vi.mocked(exec).mockImplementationOnce(async (command, args, options) => {
      const writable = options?.stdout as Writable
      writable.write(Buffer.from(`2023-01-30T15:37:11Z INF |  https://bad_url.com`))
      writable.write(Buffer.from(`2023-01-30T15:37:11Z INF Connection registered`))
    })

    // When
    const tunnelClient = await hookStart(port)
    const result = tunnelClient.valueOrAbort().getTunnelStatus()

    // Then
    expect(result).toEqual({status: 'error', message: 'Could not start Cloudflare tunnel: URL not found.'})
  })

  test('returns starting status if a URL is detected but there is no connection yet', async () => {
    // Given
    vi.mocked(exec).mockImplementationOnce(async (command, args, options) => {
      const writable = options?.stdout as Writable
      writable.write(Buffer.from(`2023-01-30T15:37:11Z INF |  https://example.trycloudflare.com`))
    })

    // When
    const tunnelClient = await hookStart(port)
    const result = tunnelClient.valueOrAbort().getTunnelStatus()

    // Then
    expect(result).toEqual({status: 'starting'})
  })

  test('if the process crashes, it retries again', async () => {
    // Given
    vi.mocked(exec).mockImplementationOnce(async (command, args, options) => {
      await options?.externalErrorHandler?.(new Error('Process crashed'))
    })

    vi.mocked(exec).mockImplementationOnce(async (command, args, options) => {
      const writable = options?.stdout as Writable
      writable.write(Buffer.from(`2023-01-30T15:37:11Z INF |  https://example.trycloudflare.com`))
      writable.write(Buffer.from(`2023-01-30T15:37:11Z INF Connection registered`))
    })

    // When
    const tunnelClient = await hookStart(port)
    const result = tunnelClient.valueOrAbort().getTunnelStatus()

    // Then
    expect(exec).toBeCalledTimes(2)
    expect(result).toEqual({url: 'https://example.trycloudflare.com', status: 'connected'})
  })

  test('if the process crashes many times, stops retrying', async () => {
    // Given
    vi.mocked(exec).mockImplementation(async (command, args, options) => {
      await options?.externalErrorHandler?.(new Error('Process crashed'))
    })

    // When
    const tunnelClient = (await hookStart(port)).valueOrAbort()
    const result = tunnelClient.getTunnelStatus()

    // Then
    expect(exec).toBeCalledTimes(5)
    expect(result).toEqual({
      status: 'error',
      message: 'Could not start Cloudflare tunnel: max retries reached.',
      tryMessage: expect.anything(),
    })
  })

  test('cleans errors coming from the log', async () => {
    // Given
    vi.mocked(exec).mockImplementation(async (command, args, options) => {
      const writable = options?.stdout as Writable
      writable.write(
        Buffer.from(
          `2023-10-11T13:32:45Z ERR Failed to serve quic connection error="Application error 0x0 (remote)" connIndex=0 event=0 ip=123.123.123.123`,
        ),
      )
    })
    // When
    const tunnelClient = (await hookStart(port)).valueOrAbort()
    await new Promise((resolve) => setTimeout(resolve, 250))
    const result = tunnelClient.getTunnelStatus()

    // Then
    expect(result).toEqual({
      status: 'error',
      message:
        'Could not start Cloudflare tunnel: Failed to serve quic connection error="Application error 0x0 (remote)" ',
      tryMessage: expect.anything(),
    })
  })

  test('returns error if it fails to install cloudflared', async () => {
    // Given
    vi.mocked(install).mockReturnValueOnce(Promise.reject(new Error('Failed to install cloudflared')))
    // When
    const tunnelClient = await hookStart(port)
    const result = tunnelClient.valueOrAbort().getTunnelStatus()

    // Then
    expect(result).toEqual({status: 'error', message: 'Failed to install cloudflared', tryMessage: expect.anything()})
  })
})
