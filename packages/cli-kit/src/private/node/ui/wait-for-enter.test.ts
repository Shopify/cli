import {waitForEnter} from './wait-for-enter.js'
import {AbortSilentError} from '../../../public/node/error.js'
import {describe, expect, test, vi} from 'vitest'
import {EventEmitter} from 'events'

class FakeStdin extends EventEmitter {
  isRaw: boolean
  setRawMode = vi.fn((mode: boolean) => {
    this.isRaw = mode
    return this
  })

  ref = vi.fn(() => this)
  unref = vi.fn(() => this)

  constructor({isRaw}: {isRaw: boolean}) {
    super()
    this.isRaw = isRaw
  }

  press(key: string): void {
    this.emit('data', Buffer.from(key))
  }

  pressEncoded(key: string): void {
    this.emit('data', key)
  }

  asStdin(): typeof process.stdin {
    return this as unknown as typeof process.stdin
  }
}

describe('waitForEnter', () => {
  test('resolves when Enter is pressed as a carriage return', async () => {
    const stdin = new FakeStdin({isRaw: false})
    const promise = waitForEnter(stdin.asStdin())

    stdin.press('\r')

    await expect(promise).resolves.toBeUndefined()
  })

  test('resolves when Enter is pressed as a line feed', async () => {
    const stdin = new FakeStdin({isRaw: false})
    const promise = waitForEnter(stdin.asStdin())

    stdin.press('\n')

    await expect(promise).resolves.toBeUndefined()
  })

  test('resolves when Space is pressed', async () => {
    const stdin = new FakeStdin({isRaw: false})
    const promise = waitForEnter(stdin.asStdin())

    stdin.press(' ')

    await expect(promise).resolves.toBeUndefined()
  })

  test('ignores other keys until Enter is pressed', async () => {
    const stdin = new FakeStdin({isRaw: false})
    const settled = vi.fn()
    const promise = waitForEnter(stdin.asStdin()).then(settled)

    stdin.press('t')
    stdin.press('p')
    await Promise.resolve()
    expect(settled).not.toHaveBeenCalled()

    stdin.press('\r')

    await expect(promise).resolves.toBeUndefined()
  })

  test('rejects with AbortSilentError when Ctrl+C is pressed', async () => {
    const stdin = new FakeStdin({isRaw: false})
    const promise = waitForEnter(stdin.asStdin())

    stdin.press('\u0003')

    await expect(promise).rejects.toBeInstanceOf(AbortSilentError)
  })

  test('resolves when Enter arrives as a utf8 string chunk because another renderer set the stdin encoding', async () => {
    const stdin = new FakeStdin({isRaw: true})
    const promise = waitForEnter(stdin.asStdin())

    stdin.pressEncoded('\r')

    await expect(promise).resolves.toBeUndefined()
  })

  test('ignores other keys that arrive as utf8 string chunks', async () => {
    const stdin = new FakeStdin({isRaw: true})
    const settled = vi.fn()
    const promise = waitForEnter(stdin.asStdin()).then(settled)

    stdin.pressEncoded('t')
    await Promise.resolve()
    expect(settled).not.toHaveBeenCalled()

    stdin.pressEncoded('\n')

    await expect(promise).resolves.toBeUndefined()
  })

  test('rejects with AbortSilentError when Ctrl+C arrives as a utf8 string chunk', async () => {
    const stdin = new FakeStdin({isRaw: true})
    const promise = waitForEnter(stdin.asStdin())

    stdin.pressEncoded('\u0003')

    await expect(promise).rejects.toBeInstanceOf(AbortSilentError)
  })

  test('resolves when Enter is part of a multi-character chunk', async () => {
    const stdin = new FakeStdin({isRaw: false})
    const promise = waitForEnter(stdin.asStdin())

    stdin.press('ab\r')

    await expect(promise).resolves.toBeUndefined()
  })

  test('turns raw mode on while waiting and back off afterwards when stdin was not raw', async () => {
    const stdin = new FakeStdin({isRaw: false})
    const promise = waitForEnter(stdin.asStdin())

    expect(stdin.setRawMode).toHaveBeenCalledWith(true)
    stdin.press('\r')
    await promise

    expect(stdin.setRawMode).toHaveBeenLastCalledWith(false)
  })

  test('leaves raw mode alone when stdin was already raw', async () => {
    const stdin = new FakeStdin({isRaw: true})
    const promise = waitForEnter(stdin.asStdin())

    stdin.press('\r')
    await promise

    expect(stdin.setRawMode).not.toHaveBeenCalled()
    expect(stdin.isRaw).toBe(true)
  })

  test('stops listening to stdin and unrefs it once settled', async () => {
    const stdin = new FakeStdin({isRaw: true})
    const promise = waitForEnter(stdin.asStdin())

    expect(stdin.ref).toHaveBeenCalledTimes(1)
    expect(stdin.listenerCount('data')).toBe(1)
    stdin.press('\r')
    await promise

    expect(stdin.listenerCount('data')).toBe(0)
    expect(stdin.unref).toHaveBeenCalledTimes(1)
  })
})
