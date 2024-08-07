import {keypress} from './ui-inputs.js'
import {FatalErrorType} from './error.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import supportsHyperlinks from 'supports-hyperlinks'

vi.mock('supports-hyperlinks')

beforeEach(() => {
  vi.mocked(supportsHyperlinks).stdout = false
})

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('keypress', async () => {
  test('waits for a keypress, managing stdin', async () => {
    let registeredListener: any
    const mockStdin = {
      setRawMode: vi.fn(),
      once: (event: string, callback: any) => {
        registeredListener = callback
      },
      ref: vi.fn(),
      unref: vi.fn(),
    } as any

    const promise = keypress(mockStdin, {skipTTYCheck: true})
    expect(mockStdin.ref).toBeCalled()
    expect(mockStdin.setRawMode).toHaveBeenLastCalledWith(true)
    // create a buffer representing pressing the enter key
    registeredListener(Buffer.from([13]))

    await promise
    expect(mockStdin.unref).toBeCalled()
    expect(mockStdin.setRawMode).toHaveBeenLastCalledWith(false)
  })

  test('rejects if sent ctrl+c', async () => {
    let registeredListener: any
    const mockStdin = {
      setRawMode: vi.fn(),
      once: (event: string, callback: any) => {
        registeredListener = callback
      },
      ref: vi.fn(),
      unref: vi.fn(),
    } as any

    const promise = keypress(mockStdin, {skipTTYCheck: true})

    // create a buffer representing pressing ctrl+c
    registeredListener(Buffer.from([3]))

    let rejected = false
    try {
      await promise
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (rejection: any) {
      expect(rejection.type).toEqual(FatalErrorType.AbortSilent)
      rejected = true
    }
    expect(rejected).toEqual(true)
  })
})
