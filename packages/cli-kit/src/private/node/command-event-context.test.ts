import {commandEventOutputMode, emitCommandEvent, runWithCommandEvents} from './command-event-context.js'
import {describe, expect, test, vi} from 'vitest'

describe('command event context', () => {
  test('shares the context across separately loaded cli-kit module instances', async () => {
    const firstModule = await import('./command-event-context.js')
    vi.resetModules()
    const secondModule = await import('./command-event-context.js')

    firstModule.runWithCommandEvents({outputMode: 'json'}, () => {
      expect(secondModule.commandEventOutputMode()).toBe('json')
    })
  })

  test('makes the channel available to nested asynchronous work', async () => {
    const sink = vi.fn()

    await runWithCommandEvents({sink, clock: () => new Date('2026-08-26T12:00:00.000Z')}, async () => {
      await Promise.resolve()
      emitCommandEvent({type: 'diagnostic', level: 'debug', message: 'Resolving store'})
    })

    expect(sink).toHaveBeenCalledWith({
      type: 'diagnostic',
      timestamp: '2026-08-26T12:00:00.000Z',
      level: 'debug',
      message: 'Resolving store',
    })
  })

  test('isolates concurrent command executions', async () => {
    const firstSink = vi.fn()
    const secondSink = vi.fn()

    await Promise.all([
      runWithCommandEvents({sink: firstSink}, async () => {
        await Promise.resolve()
        emitCommandEvent({type: 'progress', operation: 'upload', status: 'updated', message: 'First'})
      }),
      runWithCommandEvents({sink: secondSink}, async () => {
        await Promise.resolve()
        emitCommandEvent({type: 'progress', operation: 'upload', status: 'updated', message: 'Second'})
      }),
    ])

    expect(firstSink).toHaveBeenCalledWith(expect.objectContaining({message: 'First'}))
    expect(firstSink).not.toHaveBeenCalledWith(expect.objectContaining({message: 'Second'}))
    expect(secondSink).toHaveBeenCalledWith(expect.objectContaining({message: 'Second'}))
    expect(secondSink).not.toHaveBeenCalledWith(expect.objectContaining({message: 'First'}))
  })

  test('restores the outer channel after a nested execution', () => {
    const outerSink = vi.fn()
    const innerSink = vi.fn()

    runWithCommandEvents({sink: outerSink}, () => {
      emitCommandEvent({type: 'progress', operation: 'upload', status: 'updated', message: 'Before'})
      runWithCommandEvents({sink: innerSink}, () => {
        emitCommandEvent({type: 'progress', operation: 'upload', status: 'updated', message: 'Nested'})
      })
      emitCommandEvent({type: 'progress', operation: 'upload', status: 'updated', message: 'After'})
    })

    expect(outerSink.mock.calls.map(([event]) => event.message)).toEqual(['Before', 'After'])
    expect(innerSink).toHaveBeenCalledWith(expect.objectContaining({message: 'Nested'}))
  })

  test('ignores events emitted outside a command execution', () => {
    expect(() =>
      emitCommandEvent({type: 'progress', operation: 'upload', status: 'updated', message: 'Ignored'}),
    ).not.toThrow()
  })

  test('exposes the current output mode to nested work', () => {
    expect(commandEventOutputMode()).toBeUndefined()

    runWithCommandEvents({outputMode: 'json'}, () => {
      expect(commandEventOutputMode()).toBe('json')
    })

    expect(commandEventOutputMode()).toBeUndefined()
  })
})
