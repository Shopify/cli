import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

export interface SampleWebhook {
  samplePayload: string
  headers: string
  success: boolean
  userErrors: UserErrors[]
}
export interface SamplePayloadSchema {
  sendSampleWebhook: SampleWebhook
}

export interface UserErrors {
  message: string
  fields: string[]
}

const sendSampleWebhookMutation = `
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
 * @param token - Partners session token
 * @param topic - A webhook topic (eg: orders/create)
 * @param apiVersion - Api version for the topic
 * @param deliveryMethod - one of DELIVERY_METHOD
 * @param address - A destination for the webhook notification
 * @param clientSecret - A secret to generate the HMAC header apps can use to validate the origin
 * @param apiKey - Client Api Key required to validate Event-Bridge addresses
 * @returns Empty if a remote delivery was requested, payload data if a local delivery was requested
 */
export async function getWebhookSample(
  token: string,
  topic: string,
  apiVersion: string,
  deliveryMethod: string,
  address: string,
  clientSecret: string,
  apiKey?: string,
): Promise<SampleWebhook> {
  const variables = {
    topic,
    api_version: apiVersion,
    address,
    delivery_method: deliveryMethod,
    shared_secret: clientSecret,
    api_key: apiKey,
  }

  const {sendSampleWebhook: result}: SamplePayloadSchema = await partnersRequest(
    sendSampleWebhookMutation,
    token,
    variables,
  )

  return result
}
