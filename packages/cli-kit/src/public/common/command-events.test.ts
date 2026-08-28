import {createCommandEventChannel, commandEventSchema, type CommandEvent} from './command-events.js'
import {describe, expect, test, vi} from 'vitest'

describe('commandEventSchema', () => {
  test.each<CommandEvent>([
    {
      type: 'diagnostic',
      timestamp: '2026-08-26T12:00:00.000Z',
      level: 'warning',
      message: 'Using a fallback',
      code: 'fallback',
    },
    {
      type: 'progress',
      timestamp: '2026-08-26T12:00:01.000Z',
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
})

describe('createCommandEventChannel', () => {
  test('adds the timestamp when the event is emitted and delivers synchronously', () => {
    const calls: string[] = []
    const sink = vi.fn((event: CommandEvent) => calls.push(event.timestamp))
    const channel = createCommandEventChannel({
      sink,
      clock: () => new Date('2026-08-26T12:00:00.000Z'),
    })

    calls.push('before')
    channel.emit({type: 'diagnostic', level: 'debug', message: 'Resolving store'})
    calls.push('after')

    expect(calls).toEqual(['before', '2026-08-26T12:00:00.000Z', 'after'])
    expect(sink).toHaveBeenCalledWith({
      type: 'diagnostic',
      timestamp: '2026-08-26T12:00:00.000Z',
      level: 'debug',
      message: 'Resolving store',
    })
  })

  test('preserves event order', () => {
    const receivedMessages: string[] = []
    const channel = createCommandEventChannel({
      sink: (event) => receivedMessages.push(event.message),
    })

    channel.emit({type: 'progress', message: 'First'})
    channel.emit({type: 'progress', message: 'Second'})

    expect(receivedMessages).toEqual(['First', 'Second'])
  })

  test('delivers presentation details without adding them to the event', () => {
    const sink = vi.fn()
    const channel = createCommandEventChannel({
      sink,
      clock: () => new Date('2026-08-26T12:00:00.000Z'),
    })

    channel.emit({type: 'progress', message: 'Uploading files'}, {alreadyRendered: true})

    expect(sink).toHaveBeenCalledWith(
      {
        type: 'progress',
        timestamp: '2026-08-26T12:00:00.000Z',
        message: 'Uploading files',
      },
      {alreadyRendered: true},
    )
  })
})
