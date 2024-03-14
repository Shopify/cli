import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'

export interface SampleWebhook {
  samplePayload: string
  headers: string
  success: boolean
  userErrors: UserErrors[]
}

export interface SendSampleWebhookVariables {
  topic: string
  api_version: string
  address: string
  delivery_method: string
  shared_secret: string
  api_key?: string
}

export interface SendSampleWebhookSchema {
  sendSampleWebhook: SampleWebhook
}

export interface UserErrors {
  message: string
  fields: string[]
}

export const sendSampleWebhookMutation = `
  mutation samplePayload($topic: String!, $api_version: String!, $address: String!, $delivery_method: String!, $shared_secret: String!, $api_key: String) {
    sendSampleWebhook(input: {topic: $topic, apiVersion: $api_version, address: $address, deliveryMethod: $delivery_method, sharedSecret: $shared_secret, apiKey: $api_key}) {
        samplePayload
        success
        headers
        userErrors {
          message
        }
    }
  }
`

/**
 * Request the sample to partners. Partners will call core and the webhook will be emitted
 * In case the deliveryMethod is localhost and address is local, the response comes with the data the plugin
 * will redirect to a localhost port.
 * In all the other cases, core creates a job that sends the request to Captain-Hook. Captain-Hook will be in
 * charge of delivering the webhook payload to the requested destination.
 *
 * @param developerPlatformClient - The client to access the platform API
 * @param variables - The variables to send the sample webhook:
 *  - topic - The topic to send the sample webhook
 *  - api_version - The version of the topic
 *  - delivery_method - one of DELIVERY_METHOD
 *  - address - A destination for the webhook notification
 *  - shared_secret - A secret to generate the HMAC header apps can use to validate the origin
 *  - api_key - Client Api Key required to validate Event-Bridge addresses (optional)
 * @returns Empty if a remote delivery was requested, payload data if a local delivery was requested
 */
export async function getWebhookSample(
  developerPlatformClient: DeveloperPlatformClient,
  variables: SendSampleWebhookVariables,
): Promise<SampleWebhook> {
  const {sendSampleWebhook: result}: SendSampleWebhookSchema = await developerPlatformClient.sendSampleWebhook(
    variables,
  )

  return result
}
