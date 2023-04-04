import {sendUninstallWebhookToAppServer} from './send-app-uninstalled-webhook.js'
import {triggerLocalWebhook} from './trigger-local-webhook.js'
import {describe, expect, vi, test} from 'vitest'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {FetchError} from '@shopify/cli-kit/node/http'
import {Writable} from 'stream'

vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('./trigger-local-webhook.js')
vi.mock('@shopify/cli-kit/node/system')

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

const address = 'http://localhost:3000/test/path'
const storeFqdn = 'test-store.myshopify.io'

describe('sendUninstallWebhookToAppServer', () => {
  test('requests sample and API versions, triggers local webhook', async () => {
    vi.mocked(partnersRequest).mockResolvedValueOnce(apiVersionsResponse).mockResolvedValueOnce(webhookSampleResponse)
    vi.mocked(triggerLocalWebhook).mockResolvedValueOnce(true)
    const stdout = {write: vi.fn()} as unknown as Writable

    const result = await sendUninstallWebhookToAppServer({
      stdout,
      address,
      sharedSecret: 'sharedSecret',
      storeFqdn,
      token: 'token',
    })

    expect(result).toBe(true)
    expect(partnersRequest).toHaveBeenCalledTimes(2)
    expect(triggerLocalWebhook).toHaveBeenCalledWith(
      address,
      webhookSampleResponse.sendSampleWebhook.samplePayload,
      `{"header":"Header Value","X-Shopify-Shop-Domain":"${storeFqdn}"}`,
    )
    expect(stdout.write).toHaveBeenNthCalledWith(1, expect.stringMatching(/Sending APP_UNINSTALLED/))
    expect(stdout.write).toHaveBeenNthCalledWith(2, expect.stringMatching(/delivered/))
  })

  test('gracefully deals with the webhook delivery failing', async () => {
    vi.mocked(partnersRequest).mockResolvedValueOnce(apiVersionsResponse).mockResolvedValueOnce(webhookSampleResponse)
    vi.mocked(triggerLocalWebhook).mockResolvedValueOnce(false)
    const stdout = {write: vi.fn()} as unknown as Writable

    const result = await sendUninstallWebhookToAppServer({
      stdout,
      address,
      sharedSecret: 'sharedSecret',
      storeFqdn,
      token: 'token',
    })

    expect(result).toBe(false)
    expect(partnersRequest).toHaveBeenCalledTimes(2)
    expect(triggerLocalWebhook).toHaveBeenCalledTimes(1)
    expect(stdout.write).toHaveBeenNthCalledWith(1, expect.stringMatching(/Sending APP_UNINSTALLED/))
    expect(stdout.write).toHaveBeenNthCalledWith(2, expect.stringMatching(/failed/))
  })

  test("retries the webhook request if the app hasn't started yet", async () => {
    const fakeError = new FetchError('Fake error for testing', 'network')
    fakeError.code = 'ECONNREFUSED'
    vi.mocked(partnersRequest).mockResolvedValueOnce(apiVersionsResponse).mockResolvedValueOnce(webhookSampleResponse)
    vi.mocked(triggerLocalWebhook).mockRejectedValueOnce(fakeError).mockResolvedValueOnce(true)
    const stdout = {write: vi.fn()} as unknown as Writable

    const result = await sendUninstallWebhookToAppServer({
      stdout,
      address,
      sharedSecret: 'sharedSecret',
      storeFqdn,
      token: 'token',
    })

    expect(result).toBe(true)
    expect(partnersRequest).toHaveBeenCalledTimes(2)
    expect(triggerLocalWebhook).toHaveBeenCalledTimes(2)
    expect(stdout.write).toHaveBeenNthCalledWith(1, expect.stringMatching(/Sending APP_UNINSTALLED/))
    expect(stdout.write).toHaveBeenNthCalledWith(2, expect.stringMatching(/retrying/))
    expect(stdout.write).toHaveBeenNthCalledWith(3, expect.stringMatching(/delivered/))
  })
})
