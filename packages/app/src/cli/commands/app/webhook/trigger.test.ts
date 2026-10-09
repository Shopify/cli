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

test.each([['--json'], ['--json', '--no-input']])('writes one JSON result with flags %j', async (...flags) => {
  vi.mocked(webhookTriggerService).mockImplementation(async () => {
    outputInfo('Sending webhook sample.')
    return result
  })
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand(flags)
    expect(JSON.parse(stdout())).toEqual({status: 'success', delivery: result.delivery})
    expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', message: 'Sending webhook sample.'})
  })
})

test.each([
  {
    result: {status: 'failed', reason: 'sample-request', userErrors: [{message: 'Invalid topic', fields: ['topic']}]},
    error: {
      type: 'abort',
      message: 'Webhook sample request failed.',
      details: {userErrors: [{message: 'Invalid topic', fieldPath: ['topic']}]},
    },
  },
  {
    result: {status: 'failed', reason: 'localhost-delivery'},
    error: {type: 'abort', message: 'Localhost delivery failed'},
  },
] satisfies {result: WebhookTriggerResult; error: object}[])(
  'writes one fatal JSON document for $result.reason',
  async ({result, error}) => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    vi.mocked(webhookTriggerService).mockResolvedValue(result)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand().catch(handler)
      expect(JSON.parse(stdout())).toEqual({error})
      expect(stderr()).toBe('')
    })
  },
)
