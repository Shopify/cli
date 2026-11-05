import Cancel from './cancel.js'
import List from './list.js'
import Schedule from './schedule.js'
import Status from './status.js'
import Unschedule from './unschedule.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {
  testAppLinked,
  testDeveloperPlatformClient,
  testOrganization,
  testOrganizationApp,
  testProject,
} from '../../../models/app/app.test-data.js'
import {cancelMigrationOperations} from '../../../services/subscription-migrations/cancel-operations.js'
import {getMigrationOperations} from '../../../services/subscription-migrations/get-operations.js'
import {iterateMigratableSubscriptionPages} from '../../../services/subscription-migrations/list-migratable-subscriptions.js'
import {runSubmissionCommand} from '../../../services/subscription-migrations/run-submission-command.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {expect, vi} from 'vitest'
import type {MigrationOperation} from '../../../models/subscription-migrations.js'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/subscription-migrations/cancel-operations.js')
vi.mock('../../../services/subscription-migrations/get-operations.js')
vi.mock('../../../services/subscription-migrations/list-migratable-subscriptions.js')
vi.mock('../../../services/subscription-migrations/run-submission-command.js')

const operation: MigrationOperation = {
  id: 'gid://shopify/AppSubscriptionMigrationOperation/1',
  status: 'COMPLETED',
  total: 1,
  results: {edges: [{node: {shopId: 'gid://shopify/Shop/1', code: 'SCHEDULED'}}]},
}
const expectedOperation = {
  gid: 'gid://shopify/AppSubscriptionMigrationOperation/1',
  status: 'COMPLETED',
  total: 1,
  results: [{shopGid: 'gid://shopify/Shop/1', code: 'SCHEDULED'}],
}
const csvHeader =
  'shop_id,status,manual_subscription_name,manual_subscription_price_amount,manual_subscription_price_currency_code,manual_subscription_interval,target_plan_handle,notification_kind,notification_opt_out_deadline,notification_sent_at,price_behavior,effective_date,last_failure_reason'

function setupAppContext() {
  const context = {
    app: testAppLinked(),
    remoteApp: testOrganizationApp({apiKey: 'remote-client-id'}),
    developerPlatformClient: testDeveloperPlatformClient(),
    organization: testOrganization(),
    specifications: [],
    project: testProject(),
    activeConfig: {} as never,
  }
  vi.mocked(linkedAppContext).mockResolvedValue(context)
  return context
}

const operationArgs = ['--id', operation.id]
const operationSchema = {type: 'object', additionalProperties: false}
const submissionCommands = [
  {command: Schedule, name: 'schedule'},
  {command: Unschedule, name: 'unschedule'},
] as const
const commands = [
  {command: List, name: 'list', args: [], result: {subscriptions: []}, schema: operationSchema},
  {
    command: Status,
    name: 'status',
    args: operationArgs,
    result: {operations: [expectedOperation]},
    schema: operationSchema,
  },
  {
    command: Cancel,
    name: 'cancel',
    args: operationArgs,
    result: {
      status: 'success',
      operations: [{status: 'success', operationGid: operation.id, operation: expectedOperation}],
    },
    schema: operationSchema,
  },
  ...submissionCommands.map(({command, name}) => ({
    command,
    name,
    args: ['--input', '-', '--force'],
    result: {
      status: 'success',
      changed: true,
      clientId: 'remote-client-id',
      action: name,
      inputDigest: 'input-digest',
      total: 1,
      operations: [{batchIndex: 0, batchPayloadDigest: 'batch-digest', operation: expectedOperation}],
    },
    schema: {anyOf: expect.any(Array)},
  })),
]

for (const {command, name, args, result, schema} of commands) {
  describeJsonCommand({
    command,
    commandId: `app:subscription-migrations:${name}`,
    moduleURL: new URL('../../../../../../cli/bin/dev.js', import.meta.url).href,
    args,
    expectedResult: result,
    expectedSchema: schema,
    setup: () => {
      setupAppContext()
      vi.mocked(iterateMigratableSubscriptionPages).mockImplementation(async function* () {
        yield []
      })
      vi.mocked(getMigrationOperations).mockResolvedValue([operation])
      vi.mocked(cancelMigrationOperations).mockResolvedValue({
        outcomes: [{status: 'success', operationId: operation.id, operation}],
      })
      vi.mocked(runSubmissionCommand).mockImplementation(async ({action}) => ({
        status: 'success',
        submission: {
          clientId: 'remote-client-id',
          action,
          inputDigest: 'input-digest',
          total: 1,
          operations: [{batchIndex: 0, batchPayloadDigest: 'batch-digest', operation}],
        },
      }))
    },
    assertExecuted: () => {
      expect(linkedAppContext).toHaveBeenCalledOnce()
    },
    assertNotExecuted: () => {
      expect(linkedAppContext).not.toHaveBeenCalled()
      expect(cancelMigrationOperations).not.toHaveBeenCalled()
      expect(getMigrationOperations).not.toHaveBeenCalled()
      expect(iterateMigratableSubscriptionPages).not.toHaveBeenCalled()
      expect(runSubmissionCommand).not.toHaveBeenCalled()
    },
    textOutput: ({stdout, stderr}) => {
      if (command === List) {
        expect(stdout).toBe(`${csvHeader}\n`)
        expect(stderr).toBe('')
      } else {
        expect(stdout).toBe('')
        if (command === Status) {
          expect(stderr).toContain('Subscription migration operations.')
        } else if (command === Cancel) {
          expect(stderr).toContain('Subscription migration operations canceled.')
        } else {
          expect(stderr).toContain(`Subscription migrations ${name === 'schedule' ? 'scheduled' : 'unscheduled'}.`)
        }
        expect(stderr).toContain(operation.id)
      }
    },
    diagnostics: {
      setup: () => {
        const context = setupAppContext()
        vi.mocked(linkedAppContext).mockImplementation(async () => {
          outputInfo('Using the selected app.')
          return context
        })
      },
      expectedEvents: [{type: 'diagnostic', level: 'info', message: 'Using the selected app.'}],
    },
    failure: {
      setup: () => {
        vi.mocked(linkedAppContext).mockRejectedValue(new AbortError('Subscription app loading failed.'))
      },
      expectedError: {error: {type: 'abort', message: 'Subscription app loading failed.'}},
      exitCode: 1,
    },
  })
}
