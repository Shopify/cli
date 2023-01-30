import {sendUninstallWebhookToAppServer} from './send-app-uninstalled-webhook.js'
import {triggerLocalWebhook} from './trigger-local-webhook.js'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {FetchError} from '@shopify/cli-kit/node/http'
import {Writable} from 'stream'

beforeEach(async () => {
  vi.mock('@shopify/cli-kit/node/api/partners')
  vi.mock('./trigger-local-webhook.js')
  // Stub out sleep so that we don't have to wait for the retries
  vi.mock('@shopify/cli-kit/node/system')
})

afterEach(async () => {
  vi.clearAllMocks()
})

const apiVersionsResponse = {
  publicApiVersions: ['2022', '2023', 'unstable'],
}
const webhookSampleResponse = {
  sendSampleWebhook: {
    samplePayload: '{ "sampleField": "SampleValue" }',
    headers: '{ "header": "Header Value" }',
    success: false,
    userErrors: [
      {message: 'Error 1', fields: ['field1']},
      {message: 'Error 2', fields: ['field1']},
    ],
  },
}

describe('sendUninstallWebhookToAppServer', () => {
  it('requests sample and API versions, triggers local webhook', async () => {
    vi.mocked(partnersRequest).mockResolvedValueOnce(apiVersionsResponse).mockResolvedValueOnce(webhookSampleResponse)
    vi.mocked(triggerLocalWebhook).mockResolvedValueOnce(true)
    const stdout = {write: vi.fn()} as unknown as Writable

    const result = await sendUninstallWebhookToAppServer({
      stdout,
      address: 'http://localhost:3000/test/path',
      sharedSecret: 'sharedSecret',
      storeFqdn: 'test-store.myshopify.io',
      token: 'token',
    })

    expect(result).toBe(true)
    expect(partnersRequest).toHaveBeenCalledTimes(2)
    expect(triggerLocalWebhook).toHaveBeenCalledTimes(1)
  })

  it('gracefully deals with the webhook delivery failing', async () => {
    vi.mocked(partnersRequest).mockResolvedValueOnce(apiVersionsResponse).mockResolvedValueOnce(webhookSampleResponse)
    vi.mocked(triggerLocalWebhook).mockResolvedValueOnce(false)
    const stdout = {write: vi.fn()} as unknown as Writable

    const result = await sendUninstallWebhookToAppServer({
      stdout,
      address: 'http://localhost:3000/test/path',
      sharedSecret: 'sharedSecret',
      storeFqdn: 'test-store.myshopify.io',
      token: 'token',
    })

    expect(result).toBe(false)
    expect(partnersRequest).toHaveBeenCalledTimes(2)
    expect(triggerLocalWebhook).toHaveBeenCalledTimes(1)
  })

  it("retries the webhook request if the app hasn't started yet", async () => {
    const fakeError = new FetchError('Fake error for testing', 'network')
    fakeError.code = 'ECONNREFUSED'
    vi.mocked(partnersRequest).mockResolvedValueOnce(apiVersionsResponse).mockResolvedValueOnce(webhookSampleResponse)
    vi.mocked(triggerLocalWebhook).mockRejectedValueOnce(fakeError).mockResolvedValueOnce(true)
    const stdout = {write: vi.fn()} as unknown as Writable

    const result = await sendUninstallWebhookToAppServer({
      stdout,
      address: 'http://localhost:3000/test/path',
      sharedSecret: 'sharedSecret',
      storeFqdn: 'test-store.myshopify.io',
      token: 'token',
    })

    expect(result).toBe(true)
    expect(partnersRequest).toHaveBeenCalledTimes(2)
    expect(triggerLocalWebhook).toHaveBeenCalledTimes(2)
  })
})
