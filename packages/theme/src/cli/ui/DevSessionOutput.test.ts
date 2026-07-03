import {DevSessionOutput} from './DevSessionOutput.js'
import {describe, expect, test, vi} from 'vitest'

describe('DevSessionOutput', () => {
  test('emitting status fires the status listener with the payload', () => {
    const output = new DevSessionOutput()
    const listener = vi.fn()
    output.on('status', listener)

    output.status({message: 'running', type: 'success'})

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({message: 'running', type: 'success'})
  })

  test('emitting log fires the log listener with the line', () => {
    const output = new DevSessionOutput()
    const listener = vi.fn()
    output.on('log', listener)

    output.log('synced » update assets/theme.css')

    expect(listener).toHaveBeenCalledWith('synced » update assets/theme.css')
  })

  test('emitting alert fires the alert listener with the payload', () => {
    const output = new DevSessionOutput()
    const listener = vi.fn()
    output.on('alert', listener)

    output.alert({headline: 'Heads up', body: 'Something happened'})

    expect(listener).toHaveBeenCalledWith({headline: 'Heads up', body: 'Something happened'})
  })

  test('emitting error fires the session-error listener with the error', () => {
    const output = new DevSessionOutput()
    const listener = vi.fn()
    output.on('session-error', listener)

    const error = new Error('boom')
    output.error(error)

    expect(listener).toHaveBeenCalledWith(error)
  })

  test('error() does not use the reserved "error" event channel', () => {
    const output = new DevSessionOutput()
    const reservedListener = vi.fn()
    output.on('error', reservedListener)

    output.error(new Error('boom'))

    // The reserved 'error' channel must never fire; error() routes to
    // 'session-error' so it cannot trip Node's throw-on-no-listener behavior.
    expect(reservedListener).not.toHaveBeenCalled()
  })

  test('error() emitted before any subscriber is attached does not throw (mount-race safety)', () => {
    const output = new DevSessionOutput()

    // No listener attached — mirrors the window before ThemeDevUI's useEffect
    // subscribes. With the reserved 'error' event this would throw ERR_UNHANDLED_ERROR.
    expect(() => output.error(new Error('early boom'))).not.toThrow()
    expect(() => output.error('early string boom')).not.toThrow()
  })

  test('off unsubscribes a listener', () => {
    const output = new DevSessionOutput()
    const listener = vi.fn()
    output.on('log', listener)
    output.off('log', listener)

    output.log('ignored')

    expect(listener).not.toHaveBeenCalled()
  })
})
