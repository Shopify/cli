import {cloudflareVersion, hookStart} from './tunnel.js'
import {describe, vi, it, expect} from 'vitest'
import {exec} from '@shopify/cli-kit/node/system'
import {err, ok} from '@shopify/cli-kit/node/result'
import {TunnelError} from '@shopify/cli-kit/node/plugins/tunnel'
import {Writable} from 'stream'

const port = 1234
vi.mock('@shopify/cli-kit/node/system', async () => {
  const actual: any = await vi.importActual('@shopify/cli-kit/node/system')
  return {
    ...actual,
    exec: vi.fn(),
  }
})

describe('hookStart', () => {
  it('returns a url if cloudflare prints a URL and a connection is established', async () => {
    vi.mocked(exec).mockImplementationOnce(async (command, args, options) => {
      const writable = options?.stdout as Writable
      writable.write(Buffer.from(`2023-01-30T15:37:11Z INF |  https://example.com`))
      writable.write(Buffer.from(`2023-01-30T15:37:11Z INF Connection registered`))
    })

    // When
    const result = await hookStart(port)

    // Then
    expect(result).toEqual(ok({url: 'https://example.com'}))
  })

  it('throws error if cloudflare returns error before a connection is established', async () => {
    vi.mocked(exec).mockImplementationOnce(async (command, args, options) => {
      const writable = options?.stdout as Writable
      writable.write(Buffer.from(`2023-01-30T15:37:11Z INF |  https://example.com`))
      writable.write(Buffer.from(`2023-01-30T15:37:11Z ERR Couldn't start tunnel`))
    })

    // When
    const result = await hookStart(port)

    // Then
    expect(result).toEqual(err(new TunnelError('unknown', "Couldn't start tunnel")))
  })
})

describe('cloudflared binary', () => {
  it('binary has been installed and works', async () => {
    // When
    const result = await cloudflareVersion()

    // Then
    expect(result).toMatch(/cloudflared version 2023.1.0/)
  })
})
