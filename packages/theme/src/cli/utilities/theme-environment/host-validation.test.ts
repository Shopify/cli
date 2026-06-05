import {createHostValidationHandler} from './host-validation.js'

import {beforeEach, describe, expect, test, vi} from 'vitest'
import {createEvent} from 'h3'

import {networkInterfaces} from 'node:os'
import {IncomingMessage, ServerResponse} from 'node:http'
import {Socket} from 'node:net'

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>()
  return {...actual, networkInterfaces: vi.fn()}
})

const dispatchHost = async (
  handler: ReturnType<typeof createHostValidationHandler>,
  host?: string,
): Promise<number> => {
  const req = new IncomingMessage(new Socket())
  req.url = '/'
  if (host !== undefined) req.headers = {host}
  const res = new ServerResponse(req)
  const event = createEvent(req, res)

  await handler(event)

  return res.statusCode
}

describe('createHostValidationHandler', () => {
  describe('loopback bind', () => {
    const handler = createHostValidationHandler('127.0.0.1', 9292)

    test.each([['localhost:9292'], ['127.0.0.1:9292'], ['[::1]:9292'], ['LOCALHOST:9292'], ['localhost.:9292']])(
      'accepts %s',
      async (host) => {
        const status = await dispatchHost(handler, host)
        expect(status).not.toBe(400)
      },
    )

    test.each([['attacker.com:9292'], ['localhost:1234'], ['127.0.0.1']])('rejects %s', async (host) => {
      const status = await dispatchHost(handler, host)
      expect(status).toBe(400)
    })

    test('rejects missing host header', async () => {
      const status = await dispatchHost(handler)
      expect(status).toBe(400)
    })
  })

  describe('wildcard bind', () => {
    beforeEach(() => {
      vi.mocked(networkInterfaces).mockReturnValue({
        en0: [
          {
            address: '192.168.1.50',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: false,
            cidr: '192.168.1.50/24',
          },
        ],
      } as ReturnType<typeof networkInterfaces>)
    })

    const buildHandler = () => createHostValidationHandler('0.0.0.0', 9292)

    test.each([['192.168.1.50:9292'], ['127.0.0.1:9292'], ['[::1]:9292']])('accepts %s', async (host) => {
      const status = await dispatchHost(buildHandler(), host)
      expect(status).not.toBe(400)
    })

    test.each([['192.168.1.50:1234'], ['attacker.com:9292']])('rejects %s', async (host) => {
      const status = await dispatchHost(buildHandler(), host)
      expect(status).toBe(400)
    })
  })

  describe('non-wildcard LAN bind', () => {
    const handler = createHostValidationHandler('192.168.1.50', 9292)

    test.each([['192.168.1.50:9292']])('accepts %s', async (host) => {
      const status = await dispatchHost(handler, host)
      expect(status).not.toBe(400)
    })

    test.each([['192.168.1.99:9292']])('rejects %s', async (host) => {
      const status = await dispatchHost(handler, host)
      expect(status).toBe(400)
    })
  })
})
