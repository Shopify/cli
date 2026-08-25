import {outputOperations, outputSubmission} from './command-output.js'
import {planMigrationInput} from './plan/plan-migration-input.js'
import {runSubmissionCommand} from './run-submission-command.js'
import {MigrationSubmissionError, submitMigrationPlan} from './submit-migration-plan.js'
import {watchMigrationOperations} from './watch-operations.js'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {MigrationOperation} from '../../models/subscription-migrations.js'
import type {MigrationSubmission} from './submit-migration-plan.js'

vi.mock('./plan/plan-migration-input.js')
vi.mock('./submit-migration-plan.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./submit-migration-plan.js')>()
  return {...actual, submitMigrationPlan: vi.fn()}
})
vi.mock('./command-output.js')
vi.mock('./watch-operations.js')
vi.mock('@shopify/cli-kit/node/ui')

const plan = {
  action: 'schedule' as const,
  rows: [
    {
      action: 'schedule' as const,
      shopId: 'gid://shopify/Shop/1',
      targetPlanHandle: 'pro',
      priceBehavior: 'PLAN_PRICE' as const,
      notification: 'WHEN_REQUIRED' as const,
    },
  ],
  batches: [],
  canonicalInput: '{}',
  inputDigest: 'digest',
}

function operation(id: string, status: MigrationOperation['status'] = 'RUNNING'): MigrationOperation {
  return {id, status, total: 1, results: {edges: []}}
}

function submission(): MigrationSubmission {
  return {
    clientId: 'client-id',
    action: 'schedule',
    rootIdempotencyKey: 'root-key',
    inputDigest: 'digest',
    total: 2,
    operations: [
      {
        batchIndex: 0,
        batchPayloadDigest: 'batch-digest-0',
        idempotencyKey: 'batch-key-0',
        operation: operation('one'),
      },
      {
        batchIndex: 1,
        batchPayloadDigest: 'batch-digest-1',
        idempotencyKey: 'batch-key-1',
        operation: operation('two'),
      },
    ],
  }
}

const baseOptions = {
  action: 'schedule' as const,
  input: 'migrations.csv',
  clientId: 'client-id',
  skipConfirmation: true,
  json: true,
  watch: false,
}

describe('runSubmissionCommand', () => {
  beforeEach(() => {
    vi.mocked(planMigrationInput).mockReset()
    vi.mocked(submitMigrationPlan).mockReset()
    vi.mocked(outputSubmission).mockReset()
    vi.mocked(outputOperations).mockReset()
    vi.mocked(watchMigrationOperations).mockReset()
    vi.mocked(renderConfirmationPrompt).mockReset()
  })

  test('aggregates validation errors before prompting or submitting', async () => {
    vi.mocked(planMigrationInput).mockResolvedValue({
      ok: false,
      errors: [
        {row: 2, field: 'shop_id', message: 'Invalid shop'},
        {row: 3, field: 'target_plan_handle', message: 'Target plan handle is required'},
      ],
    })

    const promise = runSubmissionCommand({...baseOptions, skipConfirmation: false})

    await expect(promise).rejects.toBeInstanceOf(AbortError)
    await expect(promise).rejects.toThrow(
      'row 2, shop_id: Invalid shop\nrow 3, target_plan_handle: Target plan handle is required',
    )
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(submitMigrationPlan).not.toHaveBeenCalled()
  })

  test('silently aborts when confirmation is refused', async () => {
    vi.mocked(planMigrationInput).mockResolvedValue({ok: true, plan})
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

    await expect(runSubmissionCommand({...baseOptions, skipConfirmation: false})).rejects.toBeInstanceOf(
      AbortSilentError,
    )
    expect(renderConfirmationPrompt).toHaveBeenCalledOnce()
    expect(submitMigrationPlan).not.toHaveBeenCalled()
  })

  test('skips the prompt and outputs an unwatched submission', async () => {
    const submitted = submission()
    vi.mocked(planMigrationInput).mockResolvedValue({ok: true, plan})
    vi.mocked(submitMigrationPlan).mockResolvedValue(submitted)

    await runSubmissionCommand({...baseOptions, rootIdempotencyKey: 'root-key'})

    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(submitMigrationPlan).toHaveBeenCalledWith({
      clientId: 'client-id',
      plan,
      rootIdempotencyKey: 'root-key',
    })
    expect(watchMigrationOperations).not.toHaveBeenCalled()
    expect(outputSubmission).toHaveBeenCalledWith(submitted, {json: true})
    expect(outputSubmission).toHaveBeenCalledOnce()
    expect(outputOperations).not.toHaveBeenCalled()
  })

  test('outputs accepted partial submission evidence as a warning before rethrowing', async () => {
    const partialSubmission = submission()
    const error = new MigrationSubmissionError(partialSubmission, 2, [{message: 'Rejected', field: ['input']}])
    vi.mocked(planMigrationInput).mockResolvedValue({ok: true, plan})
    vi.mocked(submitMigrationPlan).mockRejectedValue(error)

    const promise = runSubmissionCommand({...baseOptions, json: false})

    await expect(promise).rejects.toBe(error)
    expect(outputSubmission).toHaveBeenCalledWith(partialSubmission, {json: false, partial: true})
    expect(partialSubmission.rootIdempotencyKey).toBe('root-key')
    expect(partialSubmission.operations.map(({operation}) => operation.id)).toEqual(['one', 'two'])
    expect(watchMigrationOperations).not.toHaveBeenCalled()
    expect(outputOperations).not.toHaveBeenCalled()
  })

  test.each(['schedule', 'unschedule'] as const)(
    'outputs accepted %s submission evidence before watching and outputs terminal operations once',
    async (action) => {
      const submitted = {...submission(), action}
      const terminalOperations = [operation('one', 'FAILED'), operation('two', 'COMPLETED')]
      vi.mocked(planMigrationInput).mockResolvedValue({ok: true, plan: {...plan, action}})
      vi.mocked(submitMigrationPlan).mockResolvedValue(submitted)
      vi.mocked(watchMigrationOperations).mockResolvedValue(terminalOperations)

      await runSubmissionCommand({...baseOptions, action, json: false, watch: true})

      expect(watchMigrationOperations).toHaveBeenCalledWith({
        clientId: 'client-id',
        operationIds: ['one', 'two'],
      })
      expect(outputSubmission).toHaveBeenCalledWith(submitted, {json: false})
      expect(outputSubmission).toHaveBeenCalledOnce()
      expect(outputSubmission).toHaveBeenCalledBefore(vi.mocked(watchMigrationOperations))
      expect(outputOperations).toHaveBeenCalledWith(terminalOperations, false)
      expect(outputOperations).toHaveBeenCalledOnce()
    },
  )

  test('outputs one final JSON submission with terminal operations merged by ID', async () => {
    const submitted = submission()
    const completedTwo = operation('two', 'COMPLETED')
    const failedOne = operation('one', 'FAILED')
    vi.mocked(planMigrationInput).mockResolvedValue({ok: true, plan})
    vi.mocked(submitMigrationPlan).mockResolvedValue(submitted)
    vi.mocked(watchMigrationOperations).mockResolvedValue([completedTwo, failedOne])

    await runSubmissionCommand({...baseOptions, watch: true})

    expect(watchMigrationOperations).toHaveBeenCalledWith({clientId: 'client-id', operationIds: ['one', 'two']})
    expect(outputSubmission).toHaveBeenCalledWith(
      {
        ...submitted,
        operations: [
          {...submitted.operations[0], operation: failedOne},
          {...submitted.operations[1], operation: completedTwo},
        ],
      },
      {json: true},
    )
    expect(outputSubmission).toHaveBeenCalledOnce()
    expect(outputOperations).not.toHaveBeenCalled()
  })
})
