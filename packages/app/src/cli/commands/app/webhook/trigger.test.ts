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

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/webhook/trigger.js')

const app = testAppLinked()
const result: WebhookTriggerResult = {
  status: 'success',
  result: {
    status: 'success',
    delivery: {
      topic: 'orders/create',
      apiVersion: '2026-10',
      deliveryMethod: 'http',
      address: 'https://example.com/webhooks',
      status: 'enqueued',
    },
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

async function runCommand() {
  const argv = [
    '--json',
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

test('writes one public JSON result with diagnostics on stderr', async () => {
  vi.mocked(webhookTriggerService).mockImplementation(async () => {
    outputInfo('Sending webhook sample.')
    return result
  })
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand()
    expect(JSON.parse(stdout())).toEqual({
      status: 'success',
      delivery: {
        topic: 'orders/create',
        apiVersion: '2026-10',
        deliveryMethod: 'http',
        address: 'https://example.com/webhooks',
        status: 'enqueued',
      },
    })
    expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', message: 'Sending webhook sample.'})
  })
})

test('writes one fatal JSON document when the sample request fails', async () => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  vi.mocked(webhookTriggerService).mockResolvedValue({
    status: 'failed',
    reason: 'sample-request',
    userErrors: [{message: 'Invalid topic', fields: ['topic']}],
  })
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand().catch(handler)
    expect(JSON.parse(stdout())).toEqual({
      error: {
        type: 'abort',
        message: 'Webhook sample request failed.',
        details: {userErrors: [{message: 'Invalid topic', fieldPath: ['topic']}]},
      },
    })
    expect(stderr()).toBe('')
  })
})
