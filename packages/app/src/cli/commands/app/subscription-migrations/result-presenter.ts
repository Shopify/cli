import {encodeMigrationCancellationResult, encodeMigrationSubmissionResult} from './result-codec.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import type {MigrationOperation} from '../../../models/subscription-migrations.js'
import type {
  MigrationCancellationOutcome,
  MigrationCancellationResult,
} from '../../../services/subscription-migrations/cancel-operations.js'
import type {
  MigrationSubmission,
  MigrationSubmissionResult,
} from '../../../services/subscription-migrations/submit-migration-plan.js'

interface SubmissionPresentationOptions {
  json: boolean
  watch: boolean
}

interface CancellationPresentationOptions {
  json: boolean
}

export function presentAcceptedMigrationSubmission(submission: MigrationSubmission): void {
  renderSubmissionSuccess(submission)
}

export function presentMigrationSubmissionResult(
  result: MigrationSubmissionResult,
  options: SubmissionPresentationOptions,
): 0 | 1 {
  if (options.json) {
    outputResult(encodeMigrationSubmissionResult(result))
  } else if (result.status === 'failed') {
    renderSubmissionFailure(result)
  } else if (options.watch) {
    renderInfo({
      headline: 'Subscription migration operations.',
      body: result.submission.operations.map(({operation}) => formatMigrationOperationStatus(operation)),
    })
  } else {
    renderSubmissionSuccess(result.submission)
  }

  return result.status === 'failed' ? 1 : 0
}

export function presentMigrationCancellationResult(
  result: MigrationCancellationResult,
  options: CancellationPresentationOptions,
): 0 | 1 {
  const hasFailures = result.outcomes.some(({status}) => status === 'failed')

  if (options.json) {
    outputResult(encodeMigrationCancellationResult(result))
  } else if (hasFailures) {
    renderWarning({
      headline: 'Some subscription migration operations could not be canceled.',
      body: formatCancellationOutcomes(result.outcomes),
    })
  } else {
    renderSuccess({
      headline: 'Subscription migration operations canceled.',
      body: formatCancellationOutcomes(result.outcomes),
    })
  }

  return hasFailures ? 1 : 0
}

function renderSubmissionSuccess(submission: MigrationSubmission): void {
  const action = submission.action === 'schedule' ? 'scheduled' : 'unscheduled'
  renderSuccess({
    headline: `Subscription migrations ${action}.`,
    body: [
      `Shops: ${submission.total}`,
      'Operation IDs:',
      ...submission.operations.map(({operation}) => operation.id),
      'Save every operation ID. You will need them to check or cancel this submission.',
    ],
  })
}

function renderSubmissionFailure(result: Extract<MigrationSubmissionResult, {status: 'failed'}>): void {
  if (result.failure.type === 'operations') {
    renderWarning({
      headline: 'Some subscription migration operations failed.',
      body: [
        'Failed operation IDs:',
        ...result.failure.operationIds,
        'Terminal operation outcomes:',
        ...result.submission.operations.map(({operation}) => formatMigrationOperationStatus(operation)),
        'Save every operation ID. You will need them to inspect this submission.',
      ],
    })
    return
  }

  const operationIds = result.submission.operations.map(({operation}) => operation.id)
  renderWarning({
    headline:
      operationIds.length === 0
        ? 'Subscription migration submission failed.'
        : 'Some subscription migration operations were accepted before submission failed.',
    body: [
      ...(operationIds.length === 0 ? ['Accepted operation IDs: None.'] : ['Accepted operation IDs:', ...operationIds]),
      `Batch index: ${result.failure.batchIndex}`,
      'Errors:',
      ...result.failure.userErrors.map(({message}) => message),
      ...(operationIds.length === 0
        ? []
        : ['Save every accepted operation ID. You will need them to check or cancel accepted operations.']),
    ],
  })
}

function formatCancellationOutcomes(outcomes: MigrationCancellationOutcome[]): string[] {
  const successes = outcomes.filter(
    (outcome): outcome is Extract<MigrationCancellationOutcome, {status: 'success'}> => outcome.status === 'success',
  )
  const failures = outcomes.filter(
    (outcome): outcome is Extract<MigrationCancellationOutcome, {status: 'failed'}> => outcome.status === 'failed',
  )

  return [
    ...(successes.length === 0
      ? ['Canceled operations: None.']
      : ['Canceled operations:', ...successes.map(({operation}) => formatMigrationOperationStatus(operation))]),
    ...(failures.length === 0
      ? []
      : [
          'Failed operations:',
          ...failures.map(({operationId, operation, userErrors}) => {
            const returnedStatus = operation ? ` (returned status: ${operation.status})` : ''
            return `${operationId}: ${userErrors.map(({message}) => message).join('; ')}${returnedStatus}`
          }),
        ]),
  ]
}

function formatMigrationOperationStatus(operation: MigrationOperation): string {
  return `${operation.id}: ${operation.status} (${operation.results.edges.length}/${operation.total} settled)`
}
