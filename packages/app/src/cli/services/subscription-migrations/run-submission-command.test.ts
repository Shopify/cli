import {planMigrationInput} from './plan/plan-migration-input.js'
import {runSubmissionCommand} from './run-submission-command.js'
import {submitMigrationPlan} from './submit-migration-plan.js'
import {watchMigrationOperations} from './watch-operations.js'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {MigrationOperation} from '../../models/subscription-migrations.js'
import type {MigrationSubmission, MigrationSubmissionResult} from './submit-migration-plan.js'

vi.mock('./plan/plan-migration-input.js')
vi.mock('./submit-migration-plan.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./submit-migration-plan.js')>()
  return {...actual, submitMigrationPlan: vi.fn()}
})
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
    inputDigest: 'digest',
    total: 2,
    operations: [
      {
        batchIndex: 0,
        batchPayloadDigest: 'batch-digest-0',
        operation: operation('one'),
      },
      {
        batchIndex: 1,
        batchPayloadDigest: 'batch-digest-1',
        operation: operation('two'),
      },
    ],
  }
}

function successfulResult(): MigrationSubmissionResult {
  return {status: 'success', submission: submission()}
}

const baseOptions = {
  action: 'schedule' as const,
  input: 'migrations.csv',
  clientId: 'client-id',
  skipConfirmation: true,
  watch: false,
}

describe('runSubmissionCommand', () => {
  beforeEach(() => {
    vi.mocked(planMigrationInput).mockReset()
    vi.mocked(submitMigrationPlan).mockReset()
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

  test('returns an unwatched successful result without presenting or watching', async () => {
    const result = successfulResult()
    const onSubmissionAccepted = vi.fn()
    vi.mocked(planMigrationInput).mockResolvedValue({ok: true, plan})
    vi.mocked(submitMigrationPlan).mockResolvedValue(result)

    await expect(runSubmissionCommand({...baseOptions, onSubmissionAccepted})).resolves.toBe(result)

    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(submitMigrationPlan).toHaveBeenCalledWith({
      clientId: 'client-id',
      plan,
    })
    expect(watchMigrationOperations).not.toHaveBeenCalled()
    expect(onSubmissionAccepted).not.toHaveBeenCalled()
  })

  test('returns a failed result immediately without presenting or watching', async () => {
    const submitted = submission()
    const result: MigrationSubmissionResult = {
      status: 'failed',
      submission: submitted,
      failure: {
        type: 'submission',
        batchIndex: 2,
        userErrors: [{message: 'Rejected', field: ['input']}],
      },
    }
    const onSubmissionAccepted = vi.fn()
    vi.mocked(planMigrationInput).mockResolvedValue({ok: true, plan})
    vi.mocked(submitMigrationPlan).mockResolvedValue(result)

    await expect(runSubmissionCommand({...baseOptions, watch: true, onSubmissionAccepted})).resolves.toBe(result)

    expect(onSubmissionAccepted).not.toHaveBeenCalled()
    expect(watchMigrationOperations).not.toHaveBeenCalled()
  })

  test.each(['schedule', 'unschedule'] as const)(
    'reports an accepted %s submission before watching and returns merged terminal operations',
    async (action) => {
      const submitted = {...submission(), action}
      const acceptedResult: MigrationSubmissionResult = {status: 'success', submission: submitted}
      const terminalOperations = [operation('one', 'COMPLETED'), operation('two', 'COMPLETED')]
      const onSubmissionAccepted = vi.fn()
      vi.mocked(planMigrationInput).mockResolvedValue({ok: true, plan: {...plan, action}})
      vi.mocked(submitMigrationPlan).mockResolvedValue(acceptedResult)
      vi.mocked(watchMigrationOperations).mockResolvedValue(terminalOperations)

      const result = await runSubmissionCommand({...baseOptions, action, watch: true, onSubmissionAccepted})

      expect(onSubmissionAccepted).toHaveBeenCalledWith(submitted)
      expect(onSubmissionAccepted).toHaveBeenCalledBefore(vi.mocked(watchMigrationOperations))
      expect(watchMigrationOperations).toHaveBeenCalledWith({
        clientId: 'client-id',
        operationIds: ['one', 'two'],
      })
      expect(result).toEqual({
        status: 'success',
        submission: {
          ...submitted,
          operations: [
            {...submitted.operations[0], operation: terminalOperations[0]},
            {...submitted.operations[1], operation: terminalOperations[1]},
          ],
        },
      })
    },
  )

  test('returns a typed operation failure with mixed terminal statuses', async () => {
    const acceptedResult = successfulResult()
    const failedOne = operation('one', 'FAILED')
    const completedTwo = operation('two', 'COMPLETED')
    vi.mocked(planMigrationInput).mockResolvedValue({ok: true, plan})
    vi.mocked(submitMigrationPlan).mockResolvedValue(acceptedResult)
    vi.mocked(watchMigrationOperations).mockResolvedValue([failedOne, completedTwo])

    const result = await runSubmissionCommand({...baseOptions, watch: true})

    expect(result).toEqual({
      status: 'failed',
      submission: {
        ...acceptedResult.submission,
        operations: [
          {...acceptedResult.submission.operations[0], operation: failedOne},
          {...acceptedResult.submission.operations[1], operation: completedTwo},
        ],
      },
      failure: {type: 'operations', operationIds: ['one']},
    })
  })

  test('reports multiple failed operations in submission input order', async () => {
    const acceptedResult = successfulResult()
    const failedOne = operation('one', 'FAILED')
    const failedTwo = operation('two', 'FAILED')
    vi.mocked(planMigrationInput).mockResolvedValue({ok: true, plan})
    vi.mocked(submitMigrationPlan).mockResolvedValue(acceptedResult)
    vi.mocked(watchMigrationOperations).mockResolvedValue([failedTwo, failedOne])

    const result = await runSubmissionCommand({...baseOptions, watch: true})

    expect(result).toEqual({
      status: 'failed',
      submission: {
        ...acceptedResult.submission,
        operations: [
          {...acceptedResult.submission.operations[0], operation: failedOne},
          {...acceptedResult.submission.operations[1], operation: failedTwo},
        ],
      },
      failure: {type: 'operations', operationIds: ['one', 'two']},
    })
  })

  test('does not treat a canceled terminal operation as failed', async () => {
    const acceptedResult = successfulResult()
    const canceledOne = operation('one', 'CANCELED')
    const completedTwo = operation('two', 'COMPLETED')
    vi.mocked(planMigrationInput).mockResolvedValue({ok: true, plan})
    vi.mocked(submitMigrationPlan).mockResolvedValue(acceptedResult)
    vi.mocked(watchMigrationOperations).mockResolvedValue([canceledOne, completedTwo])

    await expect(runSubmissionCommand({...baseOptions, watch: true})).resolves.toEqual({
      status: 'success',
      submission: {
        ...acceptedResult.submission,
        operations: [
          {...acceptedResult.submission.operations[0], operation: canceledOne},
          {...acceptedResult.submission.operations[1], operation: completedTwo},
        ],
      },
    })
  })
})
