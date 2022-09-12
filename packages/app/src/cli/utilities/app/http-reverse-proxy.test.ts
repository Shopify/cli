import {runConcurrentHTTPProcessesAndPathForwardTraffic} from './http-reverse-proxy.js'
import httpProxy from 'http-proxy'
import {beforeAll, describe, expect, test, vi} from 'vitest'
import {port, output, fastify} from '@shopify/cli-kit'

beforeAll(() => {
  vi.mock('@shopify/cli-kit')
  vi.mock('http-proxy', () => {
    return {
      default: {
        createProxy: vi.fn(),
      },
    }
  })

  vi.mock('http', () => {
    return {
      createServer: () => {
        return {
          on: vi.fn(),
          listen: vi.fn(),
        }
      },
    }
  })
})

describe('runConcurrentHTTPProcessesAndPathForwardTraffic', () => {
  test('proxies to all the targets using the Fastify HTTP Proxy', async () => {
    // Given
    const server: any = {register: vi.fn(), listen: vi.fn(), close: vi.fn()}
    vi.mocked(fastify.fastify).mockReturnValue(server)
    vi.mocked(port.getRandomPort).mockResolvedValueOnce(3001)
    vi.mocked(port.getRandomPort).mockResolvedValueOnce(3002)

    // When
    const got = await runConcurrentHTTPProcessesAndPathForwardTraffic(
      3000,
      [
        {
          logPrefix: 'extensions',
          pathPrefix: '/extensions',
          action: async (stdout, stderr, signal, port) => {},
        },
        {
          logPrefix: 'web',
          action: async (stdout, stderr, signal, port) => {},
        },
      ],
      [],
    )

    // Then
    expect(httpProxy.createProxy).toHaveBeenCalled()

    const concurrentCalls = (output.concurrent as any).calls
    expect(concurrentCalls.length).toEqual(1)
    const concurrentProcesses = concurrentCalls[0][0]
    expect(concurrentProcesses[0].prefix).toEqual('extensions')
    expect(concurrentProcesses[1].prefix).toEqual('web')
    expect(server.close).not.toHaveBeenCalled()
  })

  test('uses a random port when no port is passed', async () => {
    // Given
    const server: any = {register: vi.fn(), listen: vi.fn(), close: vi.fn()}
    vi.mocked(fastify.fastify).mockReturnValue(server)
    vi.mocked(port.getRandomPort).mockResolvedValueOnce(4000)

    // When
    const got = await runConcurrentHTTPProcessesAndPathForwardTraffic(undefined, [], [])

    // Then
    expect(server.close).not.toHaveBeenCalled()
  })
})
