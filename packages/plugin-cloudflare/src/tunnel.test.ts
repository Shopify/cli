import {hookStart} from './tunnel.js'
import {describe, vi, it, expect} from 'vitest'
import {exec} from '@shopify/cli-kit/node/system'
import {err, ok} from '@shopify/cli-kit/node/result'
import {TunnelError} from '@shopify/cli-kit/node/plugins/tunnel'
import {Writable} from 'stream'

const port = 1234
vi.mock('@shopify/cli-kit/node/system')

describe('hookStart', () => {
  it('returns a url if cloudflare prints a URL and a connection is established', async () => {
    vi.mocked(exec).mockImplementationOnce(async (command, args, options) => {
      const writable = options?.stdout as Writable
      writable.write(Buffer.from(`2023-01-30T15:37:11Z INF |  https://example.trycloudflare.com`))
      writable.write(Buffer.from(`2023-01-30T15:37:11Z INF Connection registered`))
    })

    // When
    const result = await hookStart(port)

    // Then
    expect(result).toEqual(ok({url: 'https://example.trycloudflare.com'}))
  })

  it('throws if a connection is stablished but we didnt find a URL', async () => {
    vi.mocked(exec).mockImplementationOnce(async (command, args, options) => {
      const writable = options?.stdout as Writable
      writable.write(Buffer.from(`2023-01-30T15:37:11Z INF |  https://bad_url.com`))
      writable.write(Buffer.from(`2023-01-30T15:37:11Z INF Connection registered`))
    })

    // When
    const result = await hookStart(port)

    // Then
    expect(result).toEqual(err(new TunnelError('unknown', 'A connection was established but no Tunnel URL was found')))
  })

  it.each([
    '2023-01-30T15:37:11Z failed to request quick Tunnel',
    '2023-01-30T15:37:11Z failed to unmarshal quick Tunnel',
    '2023-01-30T15:37:11Z failed to parse quick Tunnel ID',
    '2023-01-30T15:37:11Z failed to provision routing',
    "2023-01-30T15:37:11Z ERR Couldn't start tunnel",
  ])(`throws if cloudflare shows %s before a connection is established`, async (message) => {
    vi.mocked(exec).mockImplementationOnce(async (command, args, options) => {
      const writable = options?.stdout as Writable
      writable.write(Buffer.from(`2023-01-30T15:37:11Z INF |  https://example.com`))
      writable.write(Buffer.from(message))
    })

    // When
    const result = await hookStart(port)

    // Then
    expect(result).toEqual(err(new TunnelError('unknown', `Timed out while creating a cloudflare tunnel: ${message}`)))
  })
})
