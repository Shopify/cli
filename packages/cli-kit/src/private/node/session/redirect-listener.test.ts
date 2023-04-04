import {RedirectListener} from './redirect-listener.js'
import {describe, test, vi, expect} from 'vitest'
import {createServer} from 'http'

vi.mock('http')

describe('RedirectListener', () => {
  test('starts and stops the server', async () => {
    // Given
    const server: any = {
      listen: vi.fn(),
      close: vi.fn(),
    }
    vi.mocked(createServer).mockReturnValue(server)
    const subject = new RedirectListener({
      port: 3000,
      host: 'localhost',
      callback: (_code, _error) => {},
    })

    // When
    await subject.start()

    // Then
    const listenCalls = vi.mocked(server.listen).mock.calls

    expect(listenCalls.length).toEqual(1)
    expect(listenCalls[0][0]).toEqual({port: 3000, host: 'localhost'})
    expect(listenCalls[0][1]).toBeTypeOf('function')
  })

  test('stops the server', async () => {
    // Given
    const server: any = {
      listen: vi.fn(),
      close: vi.fn(),
    }
    vi.mocked(createServer).mockReturnValue(server)
    const subject = new RedirectListener({
      port: 3000,
      host: 'localhost',
      callback: (_code, _error) => {},
    })

    // When/Then
    await expect(subject.stop()).resolves.toBeUndefined()
    const closeCalls = vi.mocked(server.close).mock.calls
    expect(closeCalls.length).toEqual(1)
  })

  test('stops error when the server fails to stop', async () => {
    // Given
    const server: any = {
      listen: vi.fn(),
      close: vi.fn(),
    }
    vi.mocked(createServer).mockReturnValue(server)
    const subject = new RedirectListener({
      port: 3000,
      host: 'localhost',
      callback: (_code, _error) => {},
    })

    // When/Then
    await expect(subject.stop()).resolves.toBeUndefined()
    const closeCalls = vi.mocked(server.close).mock.calls
    expect(closeCalls.length).toEqual(1)
  })
})
