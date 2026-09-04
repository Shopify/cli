import Cancel from './cancel.js'
import List from './list.js'
import Schedule from './schedule.js'
import Status from './status.js'
import Unschedule from './unschedule.js'
import {appFlags} from '../../../flags.js'
import {commands} from '../../../index.js'
import {testAppLinked, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {cancelMigrationOperations} from '../../../services/subscription-migrations/cancel-operations.js'
import {outputOperations} from '../../../services/subscription-migrations/command-output.js'
import {getMigrationOperations} from '../../../services/subscription-migrations/get-operations.js'
import {runSubmissionCommand} from '../../../services/subscription-migrations/run-submission-command.js'
import {watchMigrationOperations} from '../../../services/subscription-migrations/watch-operations.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import type {MigrationOperation} from '../../../models/subscription-migrations.js'
import type {MigrationCancellationResult} from '../../../services/subscription-migrations/cancel-operations.js'
import type {MigrationSubmissionResult} from '../../../services/subscription-migrations/submit-migration-plan.js'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/subscription-migrations/cancel-operations.js')
vi.mock('../../../services/subscription-migrations/command-output.js')
vi.mock('../../../services/subscription-migrations/get-operations.js')
vi.mock('../../../services/subscription-migrations/run-submission-command.js')
vi.mock('../../../services/subscription-migrations/watch-operations.js')
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {...actual, outputResult: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/ui')

const originalExitCode = process.exitCode

const app = testAppLinked()
const remoteApp = testOrganizationApp({apiKey: 'remote-client-id'})

beforeEach(() => {
  process.exitCode = undefined
  vi.mocked(linkedAppContext).mockResolvedValue({app, remoteApp} as Awaited<ReturnType<typeof linkedAppContext>>)
  vi.mocked(runSubmissionCommand).mockResolvedValue(successfulSubmissionResult)
  vi.mocked(cancelMigrationOperations).mockResolvedValue(successfulCancellationResult)
})

afterEach(() => {
  process.exitCode = originalExitCode
})

const completedOperation: MigrationOperation = {
  id: 'gid://shopify/AppSubscriptionMigrationOperation/1',
  status: 'COMPLETED',
  total: 1,
  results: {edges: [{node: {shopId: 'gid://shopify/Shop/1', code: 'SCHEDULED'}}]},
}

const successfulSubmissionResult: MigrationSubmissionResult = {
  status: 'success',
  submission: {
    clientId: 'active-client-id',
    action: 'schedule',
    inputDigest: 'input-digest',
    total: 1,
    operations: [
      {
        batchIndex: 0,
        batchPayloadDigest: 'batch-digest',
        operation: completedOperation,
      },
    ],
  },
}

const successfulCancellationResult: MigrationCancellationResult = {
  outcomes: [
    {
      status: 'success',
      operationId: completedOperation.id,
      operation: completedOperation,
    },
  ],
}

describe('subscription migration submission commands', () => {
  test('schedule delegates every submission option without exposing idempotency controls', async () => {
    const result = await Schedule.run([
      '--input',
      'migrations.csv',
      '--client-id',
      'schedule-client-id',
      '--force',
      '--json',
      '--watch',
    ])

    expect(linkedAppContext).toHaveBeenCalledWith({
      directory: expect.any(String),
      clientId: 'schedule-client-id',
      forceRelink: false,
      userProvidedConfigName: undefined,
    })
    expect(runSubmissionCommand).toHaveBeenCalledWith({
      action: 'schedule',
      input: 'migrations.csv',
      clientId: 'remote-client-id',
      skipConfirmation: true,
      watch: true,
    })
    expect(outputResult).toHaveBeenCalledOnce()
    expect(JSON.parse(vi.mocked(outputResult).mock.calls[0]![0] as string)).toEqual({
      schemaVersion: 1,
      ...successfulSubmissionResult.submission,
    })
    expect(result).toEqual({app})
  })

  test('schedule resolves the active configuration Client ID selected by path and config', async () => {
    await Schedule.run(['--input', 'migrations.csv', '--path', '/selected/app', '--config', 'staging', '--force'])

    expect(linkedAppContext).toHaveBeenCalledWith({
      directory: '/selected/app',
      clientId: undefined,
      forceRelink: false,
      userProvidedConfigName: 'staging',
    })
    expect(runSubmissionCommand).toHaveBeenCalledWith(
      expect.objectContaining({action: 'schedule', clientId: 'remote-client-id'}),
    )
  })

  test('unschedule delegates without idempotency controls', async () => {
    const result = await Unschedule.run(['--input', '-', '--client-id', 'unschedule-client-id', '--force'])

    expect(linkedAppContext).toHaveBeenCalledWith({
      directory: expect.any(String),
      clientId: 'unschedule-client-id',
      forceRelink: false,
      userProvidedConfigName: undefined,
    })
    expect(runSubmissionCommand).toHaveBeenCalledWith({
      action: 'unschedule',
      input: '-',
      clientId: 'remote-client-id',
      skipConfirmation: true,
      watch: false,
    })
    expect(result).toEqual({app})
  })

  test.each([
    {Command: Schedule, action: 'schedule'},
    {Command: Unschedule, action: 'unschedule'},
  ])('$Command.name uses stdin when input is omitted', async ({Command, action}) => {
    await Command.run(['--client-id', 'client-id', '--force'])

    expect(runSubmissionCommand).toHaveBeenCalledWith(
      expect.objectContaining({action, input: '-', clientId: 'remote-client-id'}),
    )
  })

  test('passes an accepted-submission presenter only for watched human output', async () => {
    await Schedule.run(['--input', 'migrations.csv', '--client-id', 'client-id', '--force', '--watch'])

    expect(runSubmissionCommand).toHaveBeenCalledWith(
      expect.objectContaining({onSubmissionAccepted: expect.any(Function)}),
    )
    const callback = vi.mocked(runSubmissionCommand).mock.calls[0]?.[0].onSubmissionAccepted
    callback?.(successfulSubmissionResult.submission)
    expect(renderSuccess).toHaveBeenCalledOnce()
  })

  test('renders an expected JSON operation failure once and sets exit 1 without throwing', async () => {
    const failedResult: MigrationSubmissionResult = {
      status: 'failed',
      submission: {
        ...successfulSubmissionResult.submission,
        operations: successfulSubmissionResult.submission.operations.map((submittedOperation) => ({
          ...submittedOperation,
          operation: {...submittedOperation.operation, status: 'FAILED'},
        })),
      },
      failure: {type: 'operations', operationIds: [completedOperation.id]},
    }
    vi.mocked(runSubmissionCommand).mockResolvedValue(failedResult)

    await expect(
      Schedule.run(['--input', 'migrations.csv', '--client-id', 'client-id', '--force', '--json', '--watch']),
    ).resolves.toEqual({app})

    expect(process.exitCode).toBe(1)
    expect(outputResult).toHaveBeenCalledOnce()
    expect(JSON.parse(vi.mocked(outputResult).mock.calls[0]![0] as string)).toEqual({
      schemaVersion: 1,
      ...failedResult.submission,
      failure: failedResult.failure,
    })
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('renders one expected human submission warning and sets exit 1 without throwing', async () => {
    vi.mocked(runSubmissionCommand).mockResolvedValue({
      status: 'failed',
      submission: successfulSubmissionResult.submission,
      failure: {
        type: 'submission',
        batchIndex: 1,
        userErrors: [{message: 'Rejected remaining shops', field: ['input']}],
      },
    })

    await expect(Unschedule.run(['--input', 'migrations.csv', '--client-id', 'client-id', '--force'])).resolves.toEqual(
      {app},
    )

    expect(process.exitCode).toBe(1)
    expect(renderWarning).toHaveBeenCalledOnce()
    expect(outputResult).not.toHaveBeenCalled()
  })

  test.each([Schedule, Unschedule])(
    '$name rejects positional CSV input before calling its service',
    async (Command) => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(Command.run(['migrations.csv', '--force'])).rejects.toThrow()

      expect(runSubmissionCommand).not.toHaveBeenCalled()
    },
  )
})

describe('subscription migration operation commands', () => {
  test('status watches every repeated ID and outputs final JSON once', async () => {
    vi.mocked(watchMigrationOperations).mockResolvedValue([completedOperation])

    const result = await Status.run([
      '--client-id',
      'status-client-id',
      '--id',
      'gid://shopify/AppSubscriptionMigrationOperation/1',
      '--id',
      'gid://shopify/AppSubscriptionMigrationOperation/2',
      '--watch',
      '--json',
      '--reset',
    ])

    expect(linkedAppContext).toHaveBeenCalledWith({
      directory: expect.any(String),
      clientId: 'status-client-id',
      forceRelink: true,
      userProvidedConfigName: undefined,
    })
    expect(watchMigrationOperations).toHaveBeenCalledWith({
      clientId: 'remote-client-id',
      operationIds: [
        'gid://shopify/AppSubscriptionMigrationOperation/1',
        'gid://shopify/AppSubscriptionMigrationOperation/2',
      ],
    })
    expect(getMigrationOperations).not.toHaveBeenCalled()
    expect(outputOperations).toHaveBeenCalledOnce()
    expect(outputOperations).toHaveBeenCalledWith([completedOperation], true)
    expect(result).toEqual({app})
  })

  test('status resolves the Client ID from the active configuration', async () => {
    vi.mocked(getMigrationOperations).mockResolvedValue([completedOperation])

    await Status.run(['--id', 'operation-id'])

    expect(linkedAppContext).toHaveBeenCalledWith({
      directory: expect.any(String),
      clientId: undefined,
      forceRelink: false,
      userProvidedConfigName: undefined,
    })
    expect(getMigrationOperations).toHaveBeenCalledWith({
      clientId: 'remote-client-id',
      operationIds: ['operation-id'],
    })
    expect(watchMigrationOperations).not.toHaveBeenCalled()
  })

  test('cancel presents every repeated ID in exactly one JSON document', async () => {
    const secondOperation = {...completedOperation, id: 'gid://shopify/AppSubscriptionMigrationOperation/2'}
    const result: MigrationCancellationResult = {
      outcomes: [
        successfulCancellationResult.outcomes[0]!,
        {
          status: 'failed',
          operationId: secondOperation.id,
          operation: secondOperation,
          userErrors: [{message: 'Already completed', field: ['id']}],
        },
      ],
    }
    vi.mocked(cancelMigrationOperations).mockResolvedValue(result)

    await expect(
      Cancel.run([
        '--client-id',
        'cancel-client-id',
        '--id',
        'gid://shopify/AppSubscriptionMigrationOperation/1',
        '--id',
        'gid://shopify/AppSubscriptionMigrationOperation/2',
        '--json',
      ]),
    ).resolves.toEqual({app})

    expect(linkedAppContext).toHaveBeenCalledWith({
      directory: expect.any(String),
      clientId: 'cancel-client-id',
      forceRelink: false,
      userProvidedConfigName: undefined,
    })
    expect(cancelMigrationOperations).toHaveBeenCalledWith({
      clientId: 'remote-client-id',
      operationIds: [
        'gid://shopify/AppSubscriptionMigrationOperation/1',
        'gid://shopify/AppSubscriptionMigrationOperation/2',
      ],
    })
    expect(outputResult).toHaveBeenCalledOnce()
    expect(JSON.parse(vi.mocked(outputResult).mock.calls[0]![0] as string)).toEqual({
      schemaVersion: 1,
      outcomes: result.outcomes,
    })
    expect(process.exitCode).toBe(1)
  })

  test('cancel resolves the Client ID from the active configuration', async () => {
    await Cancel.run(['--id', 'operation-id'])

    expect(linkedAppContext).toHaveBeenCalledWith({
      directory: expect.any(String),
      clientId: undefined,
      forceRelink: false,
      userProvidedConfigName: undefined,
    })
    expect(cancelMigrationOperations).toHaveBeenCalledWith({
      clientId: 'remote-client-id',
      operationIds: ['operation-id'],
    })
  })

  test.each([
    {Command: Status, service: getMigrationOperations},
    {Command: Cancel, service: cancelMigrationOperations},
  ])('$Command.name rejects a missing operation ID before calling its service', async ({Command, service}) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(Command.run(['--client-id', 'client-id'])).rejects.toThrow()

    expect(service).not.toHaveBeenCalled()
    expect(outputOperations).not.toHaveBeenCalled()
  })
})

describe('subscription migration command metadata', () => {
  test.each([Schedule, Unschedule, Status, Cancel, List])('$name is hidden from command discovery', (Command) => {
    expect(Command.hidden).toBe(true)
  })

  test.each([Schedule, Unschedule])('$name defines optional input flag metadata', (Command) => {
    expect(Command.flags.input).toMatchObject({
      char: 'i',
      env: 'SHOPIFY_FLAG_INPUT',
      description: 'Path to the migration CSV. If omitted, standard input is used.',
    })
    expect(Command.flags.input?.required).not.toBe(true)
  })

  test.each([Schedule, Unschedule])('$name has no static positional args', (Command) => {
    expect(Object.hasOwn(Command, 'args')).toBe(false)
  })

  test.each([Schedule, Unschedule])('$name marks force as required when non-interactive', (Command) => {
    expect(Command.flags.force).toMatchObject({
      char: 'f',
      env: 'SHOPIFY_FLAG_FORCE',
      default: false,
      requiredIfNonInteractive: true,
      description: 'Skip confirmation. Required if non interactive.',
    })
  })

  test.each([Schedule, Unschedule])('$name describes visible submission watch progress and final output', (Command) => {
    expect(Command.flags.watch.description).toBe(
      'Display the current operation state while polling, then output the final outcome when every operation reaches a terminal status.',
    )
    expect(Command.descriptionWithMarkdown).toContain(
      'human-readable output shows accepted identifiers before polling begins',
    )
    expect(Command.descriptionWithMarkdown).toContain(
      'outputs one structured JSON document after every operation reaches a terminal status',
    )
  })

  test('status describes visible watch progress and final output', () => {
    expect(Status.flags.watch.description).toBe(
      'Display the current operation state while polling, then output the final state when every operation reaches a terminal status.',
    )
    expect(Status.descriptionWithMarkdown).toContain('displays the current state while polling')
    expect(Status.descriptionWithMarkdown).toContain('outputs the final state')
  })

  test.each([Status, Cancel])('$name requires repeatable operation IDs', (Command) => {
    expect(Command.flags.id).toMatchObject({
      env: 'SHOPIFY_FLAG_ID',
      required: true,
      multiple: true,
      description: 'The app subscription migration operation ID. Can be specified multiple times.',
    })
  })

  test.each([Schedule, Unschedule, Status, Cancel, List])('$name uses all canonical app context flags', (Command) => {
    expect(Command.flags.path).toBe(appFlags.path)
    expect(Command.flags.config).toBe(appFlags.config)
    expect(Command.flags['client-id']).toBe(appFlags['client-id'])
    expect(Command.flags.reset).toBe(appFlags.reset)
    expect(Command.flags['client-id']?.required).not.toBe(true)
    expect(Command.flags['client-id']?.exclusive).toEqual(['config'])
  })

  test.each([Schedule, Unschedule, Status, Cancel, List])('$name uses the canonical JSON flag', (Command) => {
    expect(Command.flags.json).toBe(jsonFlag.json)
  })

  test.each([Schedule, Unschedule, Status, Cancel, List])('$name has no legacy migration flags', (Command) => {
    expect(Object.keys(Command.flags)).not.toEqual(
      expect.arrayContaining(['yes', 'operation', 'operation-id', 'run', 'run-id', 'idempotency-key']),
    )
  })

  test.each([Schedule, Unschedule, Status, Cancel, List])('$name extends AppLinkedCommand', (Command) => {
    expect(Object.getPrototypeOf(Command)).toBe(AppLinkedCommand)
    expect(Command.baseFlags).toBe(AppLinkedCommand.baseFlags)
    expect(Command.flags['auth-alias' as keyof typeof Command.flags]).toBeUndefined()
  })

  test('registers the five command IDs with their exact classes', () => {
    expect({
      'app:subscription-migrations:cancel': commands['app:subscription-migrations:cancel'],
      'app:subscription-migrations:list': commands['app:subscription-migrations:list'],
      'app:subscription-migrations:schedule': commands['app:subscription-migrations:schedule'],
      'app:subscription-migrations:status': commands['app:subscription-migrations:status'],
      'app:subscription-migrations:unschedule': commands['app:subscription-migrations:unschedule'],
    }).toEqual({
      'app:subscription-migrations:cancel': Cancel,
      'app:subscription-migrations:list': List,
      'app:subscription-migrations:schedule': Schedule,
      'app:subscription-migrations:status': Status,
      'app:subscription-migrations:unschedule': Unschedule,
    })
  })

  test.each([
    [Schedule, 'Schedules manual-billing subscriptions to migrate to Shopify-managed app pricing.'],
    [Unschedule, 'Reverses app subscription migrations that are still scheduled.'],
    [Status, 'Checks the status of app subscription migration operations.'],
    [Cancel, 'Cancels app subscription migration operations.'],
    [List, 'Lists app subscriptions eligible for migration.'],
  ])('$Command.name has an exact third-person summary', (Command, summary) => {
    expect(Command.summary).toBe(summary)
  })

  test.each([Schedule, Unschedule, Status, Cancel, List])(
    '$name provides action-oriented command documentation',
    (Command) => {
      expect(Command.summary).toMatch(/[.!]$/)
      expect(Command.descriptionWithMarkdown.length).toBeGreaterThan(100)
      expect(Command.description).toBe(Command.descriptionWithoutMarkdown())
      expect(Command.examples.length).toBeGreaterThan(1)
      expect(Command.examples[0]).not.toContain('--client-id')
      expect(Command.examples.some((example) => example.includes('--client-id <client-id>'))).toBe(true)
      expect(Command.descriptionWithMarkdown).toContain('app project')
      expect(Command.descriptionWithMarkdown).toContain('active app configuration')
      expect(Command.descriptionWithMarkdown).toContain('--path')
      expect(Command.descriptionWithMarkdown).toContain('--config')
      expect(Command.descriptionWithMarkdown).toContain('--client-id')
      expect(Command.descriptionWithMarkdown).toContain('--reset')
    },
  )

  test('list defines exact output, status, and overwrite force flag metadata', async () => {
    expect(List.flags.output).toMatchObject({
      description: 'Path to write the subscription export.',
      env: 'SHOPIFY_FLAG_OUTPUT',
    })
    await expect(List.flags.output.parse?.('relative/subscriptions.csv', {} as never, {} as never)).resolves.toMatch(
      /relative[/\\]subscriptions\.csv$/,
    )
    expect(List.flags.status).toMatchObject({
      description: 'Filter subscriptions by migration status.',
      env: 'SHOPIFY_FLAG_STATUS',
      options: ['UNSCHEDULED', 'SCHEDULED', 'MIGRATED'],
    })
    expect(List.flags.force).toMatchObject({
      char: 'f',
      description: 'Overwrite an existing output file.',
      env: 'SHOPIFY_FLAG_FORCE',
      default: false,
    })
    expect('requiredIfNonInteractive' in List.flags.force).toBe(false)
  })

  test('list spreads the canonical global flags', () => {
    expect(
      Object.entries(globalFlags).every(([flagName, flag]) => List.flags[flagName as keyof typeof List.flags] === flag),
    ).toBe(true)
  })

  test('list documents destinations, formats, filters, and overwrite behavior', () => {
    expect(List.descriptionWithMarkdown).toContain('all pages')
    expect(List.descriptionWithMarkdown).toContain('CSV')
    expect(List.descriptionWithMarkdown).toContain('--output')
    expect(List.descriptionWithMarkdown).toContain('--json')
    expect(List.descriptionWithMarkdown).toContain('stdout')
    expect(List.descriptionWithMarkdown).toContain('--force')
    expect(List.descriptionWithMarkdown).toContain('UNSCHEDULED')
    expect(List.descriptionWithMarkdown).toContain('SCHEDULED')
    expect(List.descriptionWithMarkdown).toContain('MIGRATED')
  })

  test.each([Schedule, Unschedule])(
    '$name documents input flag and stdin usage without positional syntax',
    (Command) => {
      expect(Command.descriptionWithMarkdown).toContain('When `--input` is omitted')
      expect(Command.descriptionWithMarkdown).toContain('`--input <path>`')
      expect(Command.descriptionWithMarkdown).toContain('`--input -`')
      expect(Command.descriptionWithMarkdown).not.toContain('required CSV path')
      expect(Command.examples.some((example) => example.includes('--input migrations.csv'))).toBe(true)
      expect(Command.examples.some((example) => example.startsWith('cat migrations.csv | '))).toBe(true)
      expect(Command.examples.every((example) => !example.includes('<%= command.id %> migrations.csv'))).toBe(true)
    },
  )

  test.each([Schedule, Unschedule, Status, Cancel, List])(
    '$name uses the configured binary and command ID in every example',
    (Command) => {
      expect(Command.examples.every((example) => example.includes('<%= config.bin %> <%= command.id %>'))).toBe(true)
    },
  )

  test.each([Schedule, Unschedule, Status, Cancel, List])(
    '$name has no fenced-code markers in its plain description',
    (Command) => {
      expect(Command.description).not.toContain('```')
    },
  )
})
