import {DELIVERY_METHOD, parseAddressAndMethod, parseVersionAndTopic, WebhookTriggerFlags} from './trigger-flags.js'
import {getWebhookSample, UserErrors} from './request-sample.js'
import {triggerLocalWebhook} from './trigger-local-webhook.js'
import {collectAddressAndMethod, collectApiVersion, collectSecret, collectTopic} from './trigger-options.js'
import {AppCredentials, findApiKey, findInEnv, requestAppInfo} from './find-app-info.js'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {consoleError, outputInfo, outputSuccess} from '@shopify/cli-kit/node/output'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'

interface WebhookTriggerOptions {
  topic: string
  apiVersion: string
  deliveryMethod: string
  address: string
  clientSecret: string
}

/**
 * Orchestrates the command request by collecting params, requesting the sample, and sending it to localhost if
 * required.
 * It outputs the result
 *
 * @param flags - Passed flags
 */
export async function webhookTriggerService(flags: WebhookTriggerFlags) {
  // Validation and collection of flags
  const [token, validFlags] = await validatedFlags(flags)

  // Request of prompts for missing flags
  const options: WebhookTriggerOptions = await collectMissingFlags(token, validFlags)

  await sendSample(token, options)
}

async function validatedFlags(flags: WebhookTriggerFlags): Promise<[string, WebhookTriggerFlags]> {
  const [deliveryMethod, address] = parseAddressAndMethod(flags)

  const token = await ensureAuthenticatedPartners()
  const [apiVersion, topic] = await parseVersionAndTopic(token, flags)

  let clientSecret
  if (isValueSet(flags.clientSecret)) {
    // Flag overwrites any other secret
    clientSecret = flags.clientSecret as string
  }

  return [
    token,
    {
      deliveryMethod,
      address,
      apiVersion,
      topic,
      clientSecret,
    },
  ]
}

async function collectMissingFlags(token: string, flags: WebhookTriggerFlags): Promise<WebhookTriggerOptions> {
  const apiVersion = await collectApiVersion(token, flags.apiVersion)

  const topic = await collectTopic(token, apiVersion, flags.topic)

  const [deliveryMethod, address] = await collectAddressAndMethod(flags.deliveryMethod, flags.address)

  const clientSecret = await collectSecret(token, flags.clientSecret)

  const options: WebhookTriggerOptions = {
    apiVersion,
    topic,
    deliveryMethod,
    address,
    clientSecret,
  }

  return options
}

export function isValueSet(value: string | undefined): boolean {
  if (value === undefined) {
    return false
  }

  return value.length > 0
}

async function sendSample(token: string, options: WebhookTriggerOptions) {
  const sample = await getWebhookSample(
    token,
    options.topic,
    options.apiVersion,
    options.deliveryMethod,
    options.address,
    options.clientSecret,
  )

  if (!sample.success) {
    consoleError(`Request errors:\n${formatErrors(sample.userErrors)}`)
    return
  }

  if (options.deliveryMethod === DELIVERY_METHOD.LOCALHOST) {
    const result = await triggerLocalWebhook(options.address, sample.samplePayload, sample.headers)

    if (result) {
      outputSuccess('Localhost delivery sucessful')
      return
    }

    consoleError('Localhost delivery failed')
    return
  }

  if (sample.samplePayload === JSON.stringify({})) {
    outputSuccess('Webhook has been enqueued for delivery')
  }
}

function formatErrors(errors: UserErrors[]): string {
  try {
    return errors
      .map((element) =>
        JSON.parse(element.message)
          .map((msg: string) => `  · ${msg}`)
          .join('\n'),
      )
      .join('\n')
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (err) {
    return JSON.stringify(errors)
  }
}

async function getSecret(token: string, clientSecretFlag: string | undefined): Promise<AppCredentials> {
  if (valueSet(clientSecretFlag)) {
    // Flag overwrites any other secret
    const credentials: AppCredentials = {clientSecret: clientSecretFlag}
    return credentials
  }

  const automatic = await renderConfirmationPrompt({
    message: `Should we automatically populate the client-secret for you using app settings?`,
    confirmationMessage: `Yes, try to get it from the configuration`,
    cancellationMessage: "No, I'll type it myself",
  })

  if (!automatic) {
    const credentials: AppCredentials = {}
    credentials.clientSecret = await collectSecret(token, clientSecretFlag)
    return credentials
  }

  const localCredentials = await findInEnv()
  if (valueSet(localCredentials.clientSecret)) {
    outputInfo('Reading client-secret from .env file')
    return localCredentials
  }

  const apiKey = await findApiKey(token)
  if (apiKey === undefined) {
    localCredentials.clientSecret = await collectSecret(token, clientSecretFlag)
    return localCredentials
  }

  const appCredentials = await requestAppInfo(token, apiKey)
  if (valueSet(appCredentials.clientSecret)) {
    outputInfo('Reading client-secret from app settings in Partners')
  } else {
    appCredentials.clientSecret = await collectSecret(token, clientSecretFlag)
  }

  return appCredentials
}

function valueSet(value: string | undefined): boolean {
  if (value === undefined) {
    return false
  }

  return value.length > 0
}
