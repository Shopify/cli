import {
  commandEventOutputSchema,
  renderCommandEvent,
  renderCommandEventAsJson,
  runWithCommandEvents,
} from './command-events.js'
import {outputWarn} from './output.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {beforeEach, describe, expect, test} from 'vitest'
import type {CommandEvent} from '../common/command-events.js'

const outputMock = mockAndCaptureOutput()

beforeEach(() => {
  outputMock.clear()
})

describe('commandEventOutputSchema', () => {
  test('renders event definitions with their validation constraints', () => {
    expect(commandEventOutputSchema.jsonSchema).toMatchObject({
      $schema: 'http://json-schema.org/draft-07/schema#',
      anyOf: [{$ref: '#/definitions/CommandDiagnosticEvent'}, {$ref: '#/definitions/CommandProgressEvent'}],
      definitions: {
        CommandDiagnosticEvent: {
          properties: {
            timestamp: {type: 'string', format: 'date-time'},
            level: {enum: ['debug', 'info', 'warning', 'error']},
          },
          additionalProperties: false,
        },
        CommandProgressEvent: {
          properties: {current: {type: 'number', minimum: 0}, total: {type: 'number', minimum: 0}},
          required: ['type', 'timestamp', 'status', 'operation'],
          additionalProperties: false,
        },
      },
    })
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
