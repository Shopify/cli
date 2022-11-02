import {
  topicPrompt,
  addressPrompt,
  apiVersionPrompt,
  localPortPrompt,
  localUrlPathPrompt,
  sharedSecretPrompt,
  deliveryMethodPrompt,
} from '../../prompts/event/trigger.js'
import {api, http, session} from '@shopify/cli-kit'

export interface SamplePayloadSchema {
  sendSampleWebhook: {
    samplePayload: string
    headers: string
    success: boolean
    userErrors: UserErrors[]
  }
}

export interface UserErrors {
  message: string
  fields: string[]
}

export const DELIVERY_METHOD = {
  LOCALHOST: 'localhost',
  HTTP: 'http',
  PUBSUB: 'google-pub-sub',
  EVENTBRIDGE: 'event-bridge',
}

const sendSampleWebhookMutation = `
  mutation samplePayload($topic: String!, $api_version: String!, $address: String!, $delivery_method: String!, $shared_secret: String!) {
    sendSampleWebhook(input: {topic: $topic, apiVersion: $api_version, address: $address, deliveryMethod: $delivery_method, sharedSecret: $shared_secret}) {
        samplePayload
        success
        headers
        userErrors {
          message
        }
    }
  }
`

export async function requestSample(
  topic: string,
  apiVersion: string,
  deliveryMethod: string,
  address: string,
  sharedSecret: string,
) {
  const token = await session.ensureAuthenticatedPartners()

  const variables = {
    topic,
    api_version: apiVersion,
    address,
    delivery_method: deliveryMethod,
    shared_secret: sharedSecret,
  }

  const {sendSampleWebhook: result}: SamplePayloadSchema = await api.partners.request(
    sendSampleWebhookMutation,
    token,
    variables,
  )

  return result
}

export async function sendLocal(address: string, body: string, headers: string) {
  const options = {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/json',
      ...JSON.parse(headers),
    },
  }
  const response = await http.fetch(address, options)
  return response.status === 200
}

export interface TestWebhookOptions {
  topic: string
  apiVersion: string
  deliveryMethod: string
  sharedSecret: string
  localhostPort: string
  localhostUrlPath: string
  address: string
}

export interface TestWebhookFlags {
  topic?: string
  apiVersion?: string
  deliveryMethod?: string
  port?: string
  address?: string
  urlPath?: string
}

export async function collectCliOptions(flags: TestWebhookFlags): Promise<TestWebhookOptions> {
  const options: TestWebhookOptions = {
    topic: await collectParam(flags.topic as string, topicPrompt),
    apiVersion: await collectParam(flags.apiVersion as string, apiVersionPrompt),
    sharedSecret: await collectParam(process.env.SHOPIFY_FLAG_SHARED_SECRET as string, sharedSecretPrompt),
    deliveryMethod: await collectParam(flags.deliveryMethod as string, deliveryMethodPrompt),
    address: '',
    localhostPort: '',
    localhostUrlPath: '',
  }

  if (options.deliveryMethod === DELIVERY_METHOD.HTTP) {
    options.address = await collectParam(flags.address as string, addressPrompt, 'http://localhost')

    const url = new URL(options.address)
    if (isLocal(url)) {
      options.deliveryMethod = DELIVERY_METHOD.LOCALHOST
      options.localhostPort = await collectParam(flagOverAddressField(flags.port as string, url.port), localPortPrompt)
      url.port = options.localhostPort

      const urlPath = url.pathname === '/' ? '' : url.pathname
      options.localhostUrlPath = await collectParam(
        flagOverAddressField(flags.urlPath as string, urlPath),
        localUrlPathPrompt,
      )
      url.pathname = options.localhostUrlPath

      options.address = url.toString()
    }
  } else {
    options.address = await collectParam(flags.address as string, addressPrompt)
  }

  return options
}

async function collectParam(
  value: string,
  prompt: (defaultValue?: string) => Promise<string>,
  defaultValue?: string,
): Promise<string> {
  return value ? value : prompt(defaultValue)
}

function flagOverAddressField(flag: string, addressField: string): string {
  return flag ? flag : addressField
}

function isLocal(url: URL): boolean {
  return url.hostname === 'localhost'
}
