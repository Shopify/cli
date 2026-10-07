import WebhookTrigger from './trigger.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {requestApiVersions} from '../../../services/webhook/request-api-versions.js'
import {requestTopics} from '../../../services/webhook/request-topics.js'
import {getWebhookSample} from '../../../services/webhook/request-sample.js'
import {triggerLocalWebhook} from '../../../services/webhook/trigger-local-webhook.js'
import {appWebhookTriggerJsonOutputSchema} from '../../../services/webhook/trigger/types.js'
import {
  testAppLinked,
  testDeveloperPlatformClient,
  testOrganization,
  testOrganizationApp,
  testProject,
} from '../../../models/app/app.test-data.js'
import {topicPrompt} from '../../../prompts/webhook/trigger.js'
import {Config} from '@oclif/core'
import {afterEach, beforeEach, expect, test, vi} from 'vitest'
import {AbortError, handler} from '@shopify/cli-kit/node/error'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {unstyled} from '@shopify/cli-kit/node/output'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/webhook/request-api-versions.js')
vi.mock('../../../services/webhook/request-topics.js')
vi.mock('../../../services/webhook/request-sample.js')
vi.mock('../../../services/webhook/trigger-local-webhook.js')
vi.mock('@shopify/cli-kit/node/system', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/system')>()
  return {...actual, terminalSupportsPrompting: vi.fn(actual.terminalSupportsPrompting)}
})
vi.mock('../../../prompts/webhook/trigger.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../prompts/webhook/trigger.js')>()
  return {...actual, topicPrompt: vi.fn()}
})

const app = testAppLinked()
const secret = 'PRIVATE_CLIENT_SECRET'
const sample = {success: true, samplePayload: '{}', headers: '{}', userErrors: []}
const flags = ['--api-version', '2026-10', '--address', 'https://example.com/webhooks', '--client-secret', secret]

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
  vi.mocked(requestApiVersions).mockResolvedValue(['2026-10'])
  vi.mocked(requestTopics).mockResolvedValue(['orders/create'])
  vi.mocked(getWebhookSample).mockResolvedValue(sample)
})

afterEach(() => {
  mockAndCaptureOutput().clear()
  vi.unstubAllEnvs()
})

async function runCommand(argv: string[]) {
  const command = new WebhookTrigger(argv, await Config.load())
  return runWithCommandEventsForCommand(argv, () => command.run())
}

test.each(['http', 'google-pub-sub', 'event-bridge'])(
  'writes one JSON delivery result without request credentials: %s',
  async (deliveryMethod) => {
    const address = {
      http: 'https://example.com/webhooks',
      'google-pub-sub': 'pubsub://project:topic',
      'event-bridge': 'arn:aws:events:us-east-1::event-source/aws.partner/shopify.com/12/source',
    }[deliveryMethod]!
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await expect(
        runCommand([
          '--json',
          '--no-input',
          '--topic',
          'orders/create',
          '--api-version',
          '2026-10',
          '--address',
          address,
          '--delivery-method',
          deliveryMethod,
          '--client-secret',
          secret,
          '--client-id',
          'client-id',
        ]),
      ).resolves.toEqual({app})
      expect(JSON.parse(stdout())).toEqual({
        status: 'success',
        delivery: {topic: 'orders/create', apiVersion: '2026-10', deliveryMethod, address, status: 'enqueued'},
      })
      expect(stdout()).not.toContain(secret)
      expect(stdout()).not.toContain('headers')
      expect(stderr()).toBe('')
    })
  },
)

test('writes a confirmed localhost delivery without payload or headers', async () => {
  vi.mocked(getWebhookSample).mockResolvedValue({
    ...sample,
    samplePayload: '{"private":"payload"}',
    headers: '{"authorization":"PRIVATE_HEADER"}',
  })
  vi.mocked(triggerLocalWebhook).mockResolvedValue(true)
  const address = 'http://localhost:3000/webhooks'
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand([
      '--json',
      '--topic',
      'orders/create',
      '--api-version',
      '2026-10',
      '--address',
      address,
      '--client-secret',
      secret,
    ])
    expect(JSON.parse(stdout())).toEqual({
      status: 'success',
      delivery: {
        topic: 'orders/create',
        apiVersion: '2026-10',
        deliveryMethod: 'localhost',
        address,
        status: 'delivered',
      },
    })
    expect(stdout()).not.toContain('payload')
    expect(stdout()).not.toContain('PRIVATE_HEADER')
    expect(stderr()).toBe('')
  })
})

test.each([
  {sampleFailure: true, expected: 'Webhook sample request failed.'},
  {sampleFailure: false, expected: 'Localhost delivery failed'},
])('uses the shared fatal envelope for a known delivery failure: $expected', async ({sampleFailure, expected}) => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  const userErrors = [{message: 'Invalid topic', fields: ['topic']}]
  if (sampleFailure) vi.mocked(getWebhookSample).mockResolvedValue({...sample, success: false, userErrors})
  else vi.mocked(triggerLocalWebhook).mockResolvedValue(false)
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    try {
      await runCommand([
        '--json',
        '--topic',
        'orders/create',
        '--api-version',
        '2026-10',
        '--address',
        'http://localhost:3000/webhooks',
        '--client-secret',
        secret,
      ])
      throw new Error('Expected delivery to fail')
    } catch (error) {
      if (!(error instanceof AbortError)) throw error
      await handler(error)
    }
    expect(JSON.parse(stdout())).toEqual({
      error: {
        type: 'abort',
        message: expected,
        ...(sampleFailure ? {details: {userErrors: [{message: 'Invalid topic', fieldPath: ['topic']}]}} : {}),
      },
    })
    expect(stderr()).toBe('')
    expect(stdout()).not.toContain(secret)
  })
})

test('propagates transport failure before printing a result', async () => {
  vi.mocked(getWebhookSample).mockRejectedValue(new Error('Network unavailable'))
  await withCapturedStandardStreams(async ({stdout}) => {
    await expect(runCommand([...flags, '--json', '--topic', 'orders/create'])).rejects.toThrow('Network unavailable')
    expect(stdout()).toBe('')
  })
})

test.each([
  {response: sample, expected: '✅ Success! Webhook has been enqueued for delivery.\n'},
  {
    response: {...sample, success: false, userErrors: [{message: '["Denied"]', fields: ['topic']}]},
    expected: 'Request errors:\n  · Denied\n',
  },
  {
    response: {...sample, success: false, userErrors: [{message: 'Denied', fields: ['topic']}]},
    expected: 'Request errors:\n[{"message":"Denied","fields":["topic"]}]\n',
  },
  {response: {...sample, samplePayload: '{"unexpected":"payload"}'}, expected: ''},
])('keeps text output and success exit behavior: $expected', async ({response, expected}) => {
  vi.mocked(getWebhookSample).mockResolvedValue(response)
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await expect(runCommand([...flags, '--topic', 'orders/create'])).resolves.toEqual({app})
    expect(stdout()).toBe('')
    expect(unstyled(stderr())).toBe(expected)
  })
})

test.each([
  {delivered: true, expected: '✅ Success! Localhost delivery sucessful.\n'},
  {delivered: false, expected: 'Localhost delivery failed\n'},
])('keeps the localhost text message and exit behavior: $delivered', async ({delivered, expected}) => {
  vi.mocked(triggerLocalWebhook).mockResolvedValue(delivered)
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await expect(
      runCommand([
        '--topic',
        'orders/create',
        '--api-version',
        '2026-10',
        '--address',
        'http://localhost:3000/webhooks',
        '--client-secret',
        secret,
      ]),
    ).resolves.toEqual({app})
    expect(stdout()).toBe('')
    expect(unstyled(stderr())).toBe(expected)
  })
})

test('JSON mode can still collect a missing topic', async () => {
  vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
  vi.mocked(topicPrompt).mockResolvedValue('orders/create')
  await withCapturedStandardStreams(async ({stdout}) => {
    await runCommand([...flags, '--json'])
    expect(JSON.parse(stdout()).status).toBe('success')
  })
  expect(topicPrompt).toHaveBeenCalledWith(['orders/create'])
})

test('returns the normalized topic for an accepted remote request with a nonempty payload', async () => {
  vi.mocked(getWebhookSample).mockResolvedValue({...sample, samplePayload: '{"id":1}'})
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand([...flags, '--json', '--topic', 'ORDERS_CREATE'])
    expect(JSON.parse(stdout()).delivery).toMatchObject({topic: 'orders/create', status: 'enqueued'})
    expect(stderr()).toBe('')
  })
})

test('no-input does not select JSON output', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand([...flags, '--no-input', '--topic', 'orders/create'])
    expect(stdout()).toBe('')
    expect(unstyled(stderr())).toBe('✅ Success! Webhook has been enqueued for delivery.\n')
  })
})

test.each([{inputFlags: ['--no-input']}, {inputFlags: ['--json', '--no-input']}])(
  'requires non-interactive inputs independently of JSON: %j',
  async ({inputFlags}) => {
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(runCommand([...flags, ...inputFlags])).rejects.toThrow()
      expect(stdout()).toBe('')
    })
    expect(linkedAppContext).not.toHaveBeenCalled()
    expect(topicPrompt).not.toHaveBeenCalled()
  },
)

test('exposes the schema and JSON flag in help', () => {
  expect(WebhookTrigger.jsonOutputSchema).toBe(appWebhookTriggerJsonOutputSchema)
  expect(WebhookTrigger.flags).toHaveProperty('json')
  expect(WebhookTrigger.descriptionForHelp()).toContain('`AppWebhookTriggerResult` schema')
  expect(WebhookTrigger.descriptionForHelp()).toContain('AppWebhookDelivery')
})
