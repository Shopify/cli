import {presentMigrationCancellationResult, presentMigrationSubmissionResult} from './result-presenter.js'
import {outputOperations} from '../../../services/subscription-migrations/command-output.js'
import {watchMigrationOperations} from '../../../services/subscription-migrations/watch-operations.js'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {beforeEach, describe, expect, test, vi} from 'vitest'
// eslint-disable-next-line n/prefer-global/console
import {Console} from 'node:console'

const isUnitTest = vi.hoisted(() => vi.fn(() => false))

vi.mock('@shopify/cli-kit/node/context/local', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/context/local')>()),
  isUnitTest,
}))

beforeEach(() => {
  isUnitTest.mockReturnValue(false)
})

describe('migration cancellation JSON output', () => {
  test('writes one parseable JSON document to stdout without stderr output', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const result = {
      outcomes: [
        {
          status: 'failed' as const,
          operationId: 'operation-one',
          operation: null,
          userErrors: [{message: 'Already completed', field: ['id']}],
        },
      ],
    }

    try {
      expect(presentMigrationCancellationResult(result, {json: true})).toBe(1)

      expect(stdout).toHaveBeenCalledOnce()
      const output = stdout.mock.calls[0]?.[0]
      expect(typeof output).toBe('string')
      expect(JSON.parse(output as string)).toEqual({outcomes: result.outcomes})
      expect(stderr).not.toHaveBeenCalled()
    } finally {
      stdout.mockRestore()
      stderr.mockRestore()
    }
  })
})

describe('migration submission JSON output', () => {
  test.each([
    {action: 'schedule' as const, watch: false},
    {action: 'schedule' as const, watch: true},
    {action: 'unschedule' as const, watch: false},
    {action: 'unschedule' as const, watch: true},
  ])('writes one final $action failure document with watch=$watch', ({action, watch}) => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const submission = {
      clientId: 'client-id',
      action,
      inputDigest: 'input-digest',
      total: 2,
      operations: [
        {
          batchIndex: 0,
          batchPayloadDigest: 'batch-digest',
          operation: {id: 'operation-one', status: 'RUNNING' as const, total: 1, results: {edges: []}},
        },
      ],
    }
    const failure = {type: 'submission' as const, batchIndex: 1, userErrors: [{message: 'Rejected', field: null}]}

    try {
      expect(presentMigrationSubmissionResult({status: 'failed', submission, failure}, {json: true, watch})).toBe(1)

      expect(stdout).toHaveBeenCalledOnce()
      expect(stdout.mock.calls[0]?.[0]).toBe(`${JSON.stringify({...submission, failure}, null, 2)}\n`)
      expect(stderr).not.toHaveBeenCalled()
    } finally {
      stdout.mockRestore()
      stderr.mockRestore()
    }
  })
})

describe('migration status JSON output', () => {
  test('writes the final result to stdout and typed watch progress to stderr', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    // Use Node's console so Vitest's console capture does not bypass stderr.
    const warn = vi.spyOn(console, 'warn').mockImplementation(new Console(process.stdout, process.stderr).warn)
    const running = {id: 'operation-one', status: 'RUNNING' as const, total: 1, results: {edges: []}}
    const completed = {...running, status: 'COMPLETED' as const}

    try {
      await runWithCommandEventsForCommand(['--json'], async () => {
        const operations = await watchMigrationOperations({
          clientId: 'client-id',
          operationIds: [running.id],
          waitForOperations: async ({onUpdate}) => {
            await onUpdate?.([running])
            await onUpdate?.([completed])
            expect(stdout).not.toHaveBeenCalled()
            return [completed]
          },
        })
        outputOperations(operations, true)
      })

      expect(stdout).toHaveBeenCalledOnce()
      expect(stdout.mock.calls[0]?.[0]).toBe(`${JSON.stringify({operations: [completed]}, null, 2)}\n`)
      const events = stderr.mock.calls.map(([content]) => JSON.parse(content as string))
      expect(events).toEqual([
        expect.objectContaining({
          type: 'progress',
          status: 'started',
          message: 'Polling subscription migration operations',
        }),
        expect.objectContaining({type: 'progress', status: 'updated', message: 'operation-one: RUNNING (0/1 settled)'}),
        expect.objectContaining({
          type: 'progress',
          status: 'updated',
          message: 'operation-one: COMPLETED (0/1 settled)',
        }),
        expect.objectContaining({type: 'progress', status: 'completed'}),
      ])
    } finally {
      warn.mockRestore()
      stdout.mockRestore()
      stderr.mockRestore()
    }
  })
})
