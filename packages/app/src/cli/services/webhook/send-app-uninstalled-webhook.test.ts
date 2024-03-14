import {sendUninstallWebhookToAppServer} from './send-app-uninstalled-webhook.js'
import {triggerLocalWebhook} from './trigger-local-webhook.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {describe, expect, vi, test} from 'vitest'
import {FetchError} from '@shopify/cli-kit/node/http'
import {Writable} from 'stream'

vi.mock('./trigger-local-webhook.js')
vi.mock('@shopify/cli-kit/node/system')

const address = 'http://localhost:3000/test/path'
const storeFqdn = 'test-store.myshopify.io'

describe('sendUninstallWebhookToAppServer', () => {
  test('requests sample and API versions, triggers local webhook', async () => {
    vi.mocked(triggerLocalWebhook).mockResolvedValueOnce(true)
    const stdout = {write: vi.fn()} as unknown as Writable

    const result = await sendUninstallWebhookToAppServer({
      stdout,
      address,
      sharedSecret: 'sharedSecret',
      storeFqdn,
      developerPlatformClient: testDeveloperPlatformClient(),
    })

    expect(result).toBe(true)
    expect(triggerLocalWebhook).toHaveBeenCalledWith(
      address,
      '{ "sampleField": "SampleValue" }',
      `{"header":"Header Value","X-Shopify-Shop-Domain":"${storeFqdn}"}`,
    )
    expect(stdout.write).toHaveBeenNthCalledWith(1, expect.stringMatching(/Sending APP_UNINSTALLED/))
    expect(stdout.write).toHaveBeenNthCalledWith(2, expect.stringMatching(/delivered/))
  })

  test('gracefully deals with the webhook delivery failing', async () => {
    vi.mocked(triggerLocalWebhook).mockResolvedValueOnce(false)
    const stdout = {write: vi.fn()} as unknown as Writable
    const developerPlatformClient = testDeveloperPlatformClient()

    const result = await sendUninstallWebhookToAppServer({
      stdout,
      address,
      sharedSecret: 'sharedSecret',
      storeFqdn,
      developerPlatformClient,
    })

    expect(result).toBe(false)
    expect(developerPlatformClient.apiVersions).toHaveBeenCalledOnce()
    expect(developerPlatformClient.sendSampleWebhook).toHaveBeenCalledOnce()
    expect(triggerLocalWebhook).toHaveBeenCalledOnce()
    expect(stdout.write).toHaveBeenNthCalledWith(1, expect.stringMatching(/Sending APP_UNINSTALLED/))
    expect(stdout.write).toHaveBeenNthCalledWith(2, expect.stringMatching(/failed/))
  })

  test("retries the webhook request if the app hasn't started yet", async () => {
    const fakeError = new FetchError('Fake error for testing', 'network')
    fakeError.code = 'ECONNREFUSED'
    vi.mocked(triggerLocalWebhook).mockRejectedValueOnce(fakeError).mockResolvedValueOnce(true)
    const stdout = {write: vi.fn()} as unknown as Writable
    const developerPlatformClient = testDeveloperPlatformClient()

    const result = await sendUninstallWebhookToAppServer({
      stdout,
      address,
      sharedSecret: 'sharedSecret',
      storeFqdn,
      developerPlatformClient,
    })

    expect(result).toBe(true)
    expect(developerPlatformClient.apiVersions).toHaveBeenCalledOnce()
    expect(developerPlatformClient.sendSampleWebhook).toHaveBeenCalledOnce()
    expect(triggerLocalWebhook).toHaveBeenCalledTimes(2)
    expect(stdout.write).toHaveBeenNthCalledWith(1, expect.stringMatching(/Sending APP_UNINSTALLED/))
    expect(stdout.write).toHaveBeenNthCalledWith(2, expect.stringMatching(/retrying/))
    expect(stdout.write).toHaveBeenNthCalledWith(3, expect.stringMatching(/delivered/))
  })
})
