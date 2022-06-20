import {RedirectListener} from './redirect-listener'
import {beforeEach, describe, it, vi, expect} from 'vitest'
import Fastify from 'fastify'

beforeEach(() => {
  vi.mock('fastify', () => {
    const server = {
      listen: vi.fn(),
      close: vi.fn(),
    }
    return {
      default: () => ({
        get: vi.fn(() => {
          return server
        }),
      }),
    }
  })
})

describe('RedirectListener', () => {
  it('starts and stops the server', async () => {
    // Given
    const subject = new RedirectListener({
      port: 3000,
      host: 'localhost',
      callback: (_code, _error) => {},
    })
    const fastify = (Fastify() as any).get()

    // When
    await subject.start()

    // Then
    const listenCalls = vi.mocked(fastify.listen).mock.calls

    expect(listenCalls.length).toEqual(1)
    expect(listenCalls[0][0]).toEqual({port: 3000, host: 'localhost'})
    expect(listenCalls[0][1]).toBeTypeOf('function')
  })

  it('stops the server', async () => {
    // Given
    const subject = new RedirectListener({
      port: 3000,
      host: 'localhost',
      callback: (_code, _error) => {},
    })
    const fastify = (Fastify() as any).get()

    // When/Then
    await expect(subject.stop()).resolves.toBeUndefined()
    const closeCalls = vi.mocked(fastify.close).mock.calls
    expect(closeCalls.length).toEqual(1)
  })

  it('stops error when the server fails to stop', async () => {
    // Given
    const subject = new RedirectListener({
      port: 3000,
      host: 'localhost',
      callback: (_code, _error) => {},
    })
    const fastify = (Fastify() as any).get()

    // When/Then
    await expect(subject.stop()).resolves.toBeUndefined()
    const closeCalls = vi.mocked(fastify.close).mock.calls
    expect(closeCalls.length).toEqual(1)
  })
})
