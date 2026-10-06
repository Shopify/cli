import {createCommandEventChannel, commandEventSchema, type CommandEvent} from './command-events.js'
import {describe, expect, test, vi} from 'vitest'

describe('commandEventSchema', () => {
  test.each<CommandEvent>([
    {
      type: 'diagnostic',
      timestamp: '2026-08-26T12:00:00Z',
      level: 'warning',
      message: 'Using a fallback',
      code: 'fallback',
    },
    {
      type: 'progress',
      operation: 'upload',
      status: 'updated',
      timestamp: '2026-08-26T12:00:01Z',
      message: 'Uploading files',
      current: 2,
      total: 10,
    },
  ])('accepts a $type event', (event) => {
    expect(commandEventSchema.parse(event)).toEqual(event)
  })

  test('rejects an event without a timestamp', () => {
    expect(() => commandEventSchema.parse({type: 'diagnostic', level: 'info', message: 'Missing timestamp'})).toThrow()
  })

  test.each([
    '2026-08-26T12:00:00.000Z',
    '2026-08-26T12:00:00.999Z',
    '2026-08-26T12:00:00+00:00',
    '2026-08-26T14:00:00+02:00',
    '2026-02-30T12:00:00Z',
  ])('rejects noncanonical timestamps on both event types: %s', (timestamp) => {
    for (const event of [
      {type: 'diagnostic', level: 'info', message: 'Resolving store'},
      {type: 'progress', operation: 'upload', status: 'started'},
    ]) {
      expect(commandEventSchema.safeParse({...event, timestamp}).success).toBe(false)
    }
  })

  test.each(['current', 'total'])('requires %s to be a nonnegative integer', (field) => {
    for (const count of [-1, 1.5, Infinity, NaN]) {
      expect(
        commandEventSchema.safeParse({
          type: 'progress',
          timestamp: '2026-08-26T12:00:00Z',
          operation: 'upload',
          status: 'updated',
          [field]: count,
        }).success,
      ).toBe(false)
    }
  })

  test('accepts non-fatal error diagnostics', () => {
    const event = {
      type: 'diagnostic',
      timestamp: '2026-08-26T12:00:00Z',
      level: 'error',
      message: 'One item could not be uploaded',
    }

    expect(commandEventSchema.parse(event)).toEqual(event)
  })

  test.each(['started', 'updated', 'retrying', 'completed', 'failed'])(
    'accepts %s progress without a message',
    (status) => {
      const event = {type: 'progress', timestamp: '2026-08-26T12:00:00Z', operation: 'upload', status}

      expect(commandEventSchema.parse(event)).toEqual(event)
    },
  )

  test.each([{operation: 'upload'}, {status: 'started'}, {operation: 'upload', status: 'unknown'}])(
    'rejects incomplete or invalid progress metadata: %j',
    (metadata) => {
      expect(() =>
        commandEventSchema.parse({type: 'progress', timestamp: '2026-08-26T12:00:00Z', ...metadata}),
      ).toThrow()
    },
  )
})

describe('createCommandEventChannel', () => {
  test('truncates fractional seconds without rounding and delivers synchronously', () => {
    const calls: string[] = []
    const sink = vi.fn((event: CommandEvent) => calls.push(event.timestamp))
    const channel = createCommandEventChannel({
      sink,
      clock: () => new Date('2026-08-26T12:00:00.999Z'),
    })

    calls.push('before')
    channel.emit({type: 'diagnostic', level: 'debug', message: 'Resolving store'})
    calls.push('after')

    expect(calls).toEqual(['before', '2026-08-26T12:00:00Z', 'after'])
    expect(sink).toHaveBeenCalledWith({
      type: 'diagnostic',
      timestamp: '2026-08-26T12:00:00Z',
      level: 'debug',
      message: 'Resolving store',
    })
  })

  test('preserves event order', () => {
    const receivedMessages: (string | undefined)[] = []
    const channel = createCommandEventChannel({
      sink: (event) => receivedMessages.push(event.message),
    })

    channel.emit({type: 'progress', operation: 'upload', status: 'updated', message: 'First'})
    channel.emit({type: 'progress', operation: 'upload', status: 'updated', message: 'Second'})

    expect(receivedMessages).toEqual(['First', 'Second'])
  })

  test('delivers presentation details without adding them to the event', () => {
    const sink = vi.fn()
    const channel = createCommandEventChannel({
      sink,
      clock: () => new Date('2026-08-26T12:00:00Z'),
    })

    channel.emit(
      {type: 'progress', operation: 'upload', status: 'updated', message: 'Uploading files'},
      {alreadyRendered: true},
    )

    expect(sink).toHaveBeenCalledWith(
      {
        type: 'progress',
        operation: 'upload',
        status: 'updated',
        timestamp: '2026-08-26T12:00:00Z',
        message: 'Uploading files',
      },
      {alreadyRendered: true},
    )
  })
})
