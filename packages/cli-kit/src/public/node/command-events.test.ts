import {
  commandEventOutputMode,
  emitCommandEvent,
  renderCommandEvent,
  renderCommandEventAsJson,
  runWithCommandEvents,
} from './command-events.js'
import {outputWarn} from './output.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {CommandEvent} from '../common/command-events.js'

const outputMock = mockAndCaptureOutput()

beforeEach(() => {
  outputMock.clear()
})

describe('command event context', () => {
  test('shares the context across separately loaded cli-kit module instances', async () => {
    const firstModule = await import('../../private/node/command-event-context.js')
    vi.resetModules()
    const secondModule = await import('../../private/node/command-event-context.js')

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

describe('renderCommandEvent', () => {
  test('renders error diagnostics without throwing or changing the exit code', () => {
    const exitCode = process.exitCode

    renderCommandEvent({
      type: 'diagnostic',
      timestamp: '2026-08-26T12:00:00.000Z',
      level: 'error',
      message: 'One item could not be uploaded',
    })

    expect(outputMock.error()).toBe('One item could not be uploaded')
    expect(process.exitCode).toBe(exitCode)
  })

  test('uses the operation as a fallback for progress without a message', () => {
    renderCommandEvent({
      type: 'progress',
      timestamp: '2026-08-26T12:00:00.000Z',
      operation: 'upload',
      status: 'started',
    })

    expect(outputMock.info()).toBe('upload')
  })
  test('renders debug diagnostics to stderr through the debug output path', () => {
    renderCommandEvent({
      type: 'diagnostic',
      timestamp: '2026-08-26T12:00:00.000Z',
      level: 'debug',
      message: 'Resolving store',
    })

    expect(outputMock.debug()).toBe('Resolving store')
    expect(outputMock.info()).toBe('')
    expect(outputMock.warn()).toBe('')
  })

  test('renders info diagnostics to stderr through the info output path', () => {
    renderCommandEvent({
      type: 'diagnostic',
      timestamp: '2026-08-26T12:00:00.000Z',
      level: 'info',
      message: 'Store resolved',
    })

    expect(outputMock.info()).toBe('Store resolved')
    expect(outputMock.debug()).toBe('')
    expect(outputMock.warn()).toBe('')
  })

  test('renders warning diagnostics to stderr through the warning output path', () => {
    renderCommandEvent({
      type: 'diagnostic',
      timestamp: '2026-08-26T12:00:00.000Z',
      level: 'warning',
      message: 'Using a fallback',
    })

    expect(outputMock.warn()).toBe('Using a fallback')
    expect(outputMock.debug()).toBe('')
    expect(outputMock.info()).toBe('')
  })

  test('renders progress to stderr without changing the structured event', () => {
    const event = {
      type: 'progress' as const,
      operation: 'upload',
      status: 'updated' as const,
      timestamp: '2026-08-26T12:00:00.000Z',
      message: 'Uploading files',
      current: 2,
      total: 10,
    }

    renderCommandEvent(event)

    expect(outputMock.info()).toBe('Uploading files')
    expect(outputMock.debug()).toBe('')
    expect(outputMock.warn()).toBe('')
    expect(event).toEqual({
      type: 'progress',
      operation: 'upload',
      status: 'updated',
      timestamp: '2026-08-26T12:00:00.000Z',
      message: 'Uploading files',
      current: 2,
      total: 10,
    })
  })
})

describe('renderCommandEventAsJson', () => {
  test.each([
    {type: 'diagnostic', level: 'unknown', message: 'Invalid level'},
    {type: 'progress', operation: 'upload', status: 'started', current: -1},
    {type: 'progress', message: 'Missing operation and status'},
    {type: 'diagnostic', level: 'info', message: 'Extra field', extra: true},
    {type: 'diagnostic', level: 'info', message: 'Invalid timestamp', timestamp: 'invalid'},
  ])('rejects invalid events before writing JSON: %j', (event) => {
    expect(() => renderCommandEventAsJson({timestamp: '2026-08-26T12:00:00.000Z', ...event} as CommandEvent)).toThrow()

    expect(outputMock.info()).toBe('')
  })

  test('renders non-fatal error diagnostics as JSON', () => {
    const event: CommandEvent = {
      type: 'diagnostic',
      timestamp: '2026-08-26T12:00:00.000Z',
      level: 'error',
      message: 'One item could not be uploaded',
    }

    renderCommandEventAsJson(event)

    expect(JSON.parse(outputMock.info())).toEqual(event)
  })

  test('renders a compact JSON event to stderr', () => {
    renderCommandEventAsJson({
      type: 'progress',
      operation: 'upload',
      status: 'updated',
      timestamp: '2026-08-26T12:00:00.000Z',
      message: 'Uploading files',
      current: 2,
      total: 10,
    })

    expect(outputMock.info()).toBe(
      '{"type":"progress","timestamp":"2026-08-26T12:00:00.000Z","status":"updated","operation":"upload","message":"Uploading files","current":2,"total":10}',
    )
    expect(outputMock.debug()).toBe('')
    expect(outputMock.warn()).toBe('')
  })

  test('renders automatic diagnostics without emitting recursively', () => {
    runWithCommandEvents(
      {
        outputMode: 'json',
        sink: renderCommandEventAsJson,
        clock: () => new Date('2026-08-26T12:00:00.000Z'),
      },
      () => outputWarn('Using a fallback'),
    )

    expect(JSON.parse(outputMock.info())).toEqual({
      type: 'diagnostic',
      level: 'warning',
      message: 'Using a fallback',
      timestamp: '2026-08-26T12:00:00.000Z',
    })
  })
})
