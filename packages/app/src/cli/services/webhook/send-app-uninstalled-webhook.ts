import {requestApiVersions} from './request-api-versions.js'
import {getWebhookSample, SampleWebhook, SendSampleWebhookVariables} from './request-sample.js'
import {triggerLocalWebhook} from './trigger-local-webhook.js'
import {DELIVERY_METHOD} from './trigger-flags.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {FetchError} from '@shopify/cli-kit/node/http'
import {sleep} from '@shopify/cli-kit/node/system'
import {Writable} from 'stream'

interface SendUninstallWebhookToAppServerOptions {
  stdout: Writable
  developerPlatformClient: DeveloperPlatformClient
  storeFqdn: string
  address: string
  sharedSecret: string
}

export async function sendUninstallWebhookToAppServer(
  options: SendUninstallWebhookToAppServerOptions,
): Promise<boolean> {
  const apiVersions = await requestApiVersions(options.developerPlatformClient)
  const variables: SendSampleWebhookVariables = {
    topic: 'app/uninstalled',
    api_version: apiVersions[1]!,
    address: options.address,
    delivery_method: DELIVERY_METHOD.LOCALHOST,
    shared_secret: options.sharedSecret,
  }
  const sample = await getWebhookSample(options.developerPlatformClient, variables)

  options.stdout.write('Sending APP_UNINSTALLED webhook to app server')

  await sleep(3)
  const result = await triggerWebhook(options, sample)

  options.stdout.write(result ? 'APP_UNINSTALLED webhook delivered' : 'APP_UNINSTALLED webhook delivery failed')

  return result
}

async function triggerWebhook(
  options: SendUninstallWebhookToAppServerOptions,
  sample: SampleWebhook,
): Promise<boolean> {
  let tries = 0

  /* eslint-disable no-await-in-loop */
  while (tries < 3) {
    try {
      const result = await triggerLocalWebhook(
        options.address,
        sample.samplePayload,
        JSON.stringify({
          ...JSON.parse(sample.headers),
          'X-Shopify-Shop-Domain': options.storeFqdn,
        }),
      )

      return result
    } catch (error) {
      if (error instanceof FetchError && error.code === 'ECONNREFUSED') {
        if (tries < 3) {
          options.stdout.write("App isn't responding yet, retrying in 5 seconds")
          await sleep(5)
        }
      } else {
        throw error
      }
    }

    tries++
  }
  /* eslint-enable no-await-in-loop */

  options.stdout.write("App hasn't started in time, giving up")

  return false
}
