import {AbortError} from './error.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {EventEmitter} from 'events'

vi.mock('./system.js', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {...actual, sleep: vi.fn()}
})

let callCount = 0
let failCount = 0

vi.mock('net', () => {
  return {
    createServer: () => {
      callCount++
      const server = new EventEmitter() as any
      server.listen = (_port: number, _host: string, cb?: () => void) => {
        if (callCount <= failCount) {
          process.nextTick(() => server.emit('error', new Error('mock port allocation failure')))
        } else {
          server.address = () => ({port: 9999})
          process.nextTick(() => cb?.())
        }
        return server
      }
      server.close = (cb?: () => void) => {
        cb?.()
        return server
      }
      return server
    },
  }
})

beforeEach(() => {
  callCount = 0
  failCount = 0
})

describe('getAvailableTCPPort retry behavior', () => {
  test('retries and returns port after transient error', async () => {
    const {getAvailableTCPPort} = await import('./tcp.js')
    const {sleep} = await import('./system.js')

    failCount = 1

    const got = await getAvailableTCPPort(undefined, {waitTimeInSeconds: 0})
    expect(got).toBe(9999)
    expect(sleep).toHaveBeenCalledOnce()
  })

  test('throws AbortError when all retries are exhausted', async () => {
    const {getAvailableTCPPort} = await import('./tcp.js')

    failCount = 100

    await expect(() => getAvailableTCPPort(undefined, {maxTries: 3, waitTimeInSeconds: 0})).rejects.toThrowError(
      AbortError,
    )
  })
})
