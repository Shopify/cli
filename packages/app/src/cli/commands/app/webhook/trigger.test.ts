import WebhookTrigger from './trigger.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {webhookTriggerService} from '../../../services/webhook/trigger.js'
import {WebhookTriggerResult} from '../../../services/webhook/trigger/types.js'
import {
  testAppLinked,
  testDeveloperPlatformClient,
  testOrganization,
  testOrganizationApp,
  testProject,
} from '../../../models/app/app.test-data.js'
import {Config} from '@oclif/core'
import {afterEach, beforeEach, expect, test, vi} from 'vitest'
import {handler} from '@shopify/cli-kit/node/error'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/webhook/trigger.js')

const app = testAppLinked()
const result: WebhookTriggerResult = {
  status: 'success',
  delivery: {
    topic: 'orders/create',
    apiVersion: '2026-10',
    deliveryMethod: 'http',
    address: 'https://example.com/webhooks',
    status: 'enqueued',
  },
  samplePayloadIsEmpty: true,
}

beforeEach(() => {
  vi.mocked(linkedAppContext).mockResolvedValue({
    app,
    remoteApp: testOrganizationApp(),
    developerPlatformClient: testDeveloperPlatformClient(),
    organization: testOrganization(),
    specifications: [],
    project: testProject(),
    activeConfig: {} as never,
  })
})

afterEach(() => vi.unstubAllEnvs())

async function runCommand(flags: string[] = ['--json']) {
  const argv = [
    ...flags,
    '--topic',
    'orders/create',
    '--api-version',
    '2026-10',
    '--address',
    'https://example.com/webhooks',
  ]
  const command = new WebhookTrigger(argv, await Config.load())
  return runWithCommandEventsForCommand(argv, () => command.run())
}

describeJsonCommand({
  command: WebhookTrigger,
  commandId: 'app:webhook:trigger',
  moduleURL: new URL('../../../../../../cli/bin/dev.js', import.meta.url).href,
  args: ['--topic', 'orders/create', '--api-version', '2026-10', '--address', 'https://example.com/webhooks'],
  expectedResult: {
    status: 'success',
    delivery: {
      topic: 'orders/create',
      apiVersion: '2026-10',
      deliveryMethod: 'http',
      address: 'https://example.com/webhooks',
      status: 'enqueued',
    },
  },
  expectedSchema: {type: 'object', required: ['status', 'delivery'], additionalProperties: false},
  setup: () => {
    vi.mocked(webhookTriggerService).mockResolvedValue(result)
  },
  assertExecuted: () => {
    expect(linkedAppContext).toHaveBeenCalledOnce()
    expect(webhookTriggerService).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        topic: 'orders/create',
        apiVersion: '2026-10',
        address: 'https://example.com/webhooks',
      }),
    )
  },
  assertNotExecuted: () => {
    expect(linkedAppContext).not.toHaveBeenCalled()
    expect(webhookTriggerService).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain('Webhook has been enqueued for delivery')
  },
  diagnostics: {
    setup: () => {
      vi.mocked(webhookTriggerService).mockImplementation(async () => {
        outputInfo('Sending webhook sample.')
        return result
      })
    },
    expectedEvents: [{type: 'diagnostic', message: 'Sending webhook sample.'}],
  },
  failure: {
    setup: () => {
      vi.mocked(webhookTriggerService).mockResolvedValue({
        status: 'failed',
        reason: 'sample-request',
        userErrors: [{message: 'Invalid topic', fields: ['topic']}],
      })
    },
    expectedError: {
      error: {
        type: 'abort',
        message: 'Webhook sample request failed.',
        details: {userErrors: [{message: 'Invalid topic', fieldPath: ['topic']}]},
      },
    },
    exitCode: 1,
  },
})

test('writes one fatal JSON document for localhost delivery failure', async () => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  vi.mocked(webhookTriggerService).mockResolvedValue({status: 'failed', reason: 'localhost-delivery'})
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand().catch(handler)
    expect(JSON.parse(stdout())).toEqual({error: {type: 'abort', message: 'Localhost delivery failed'}})
    expect(stderr()).toBe('')
  })
})
