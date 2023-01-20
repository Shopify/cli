import {DELIVERY_METHOD} from './trigger-options.js'
import {getWebhookSample, UserErrors} from './request-sample.js'
import {triggerLocalWebhook} from './trigger-local-webhook.js'
import {requestApiVersions} from './request-api-versions.js'
import {requestTopics} from './request-topics.js'
import {AppCredentials, findInEnv, findApiKey, requestAppInfo} from './find-app-info.js'
import {
  collectAddressAndMethod,
  collectApiVersion,
  collectSecret,
  collectTopic,
  WebhookTriggerFlags,
} from '../../prompts/webhook/options-prompt.js'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {consoleError, outputInfo, outputSuccess} from '@shopify/cli-kit/node/output'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'

/**
 * Orchestrates the command request by requesting the sample and sending it to localhost if required.
 * It outputs the result in console
 *
 * @param flags - Passed flags
 */
export async function webhookTriggerService(flags: WebhookTriggerFlags) {
  const token = await ensureAuthenticatedPartners()

  const apiVersion = await collectApiVersion(flags.apiVersion, await requestApiVersions(token))
  const topic = await collectTopic(flags.topic, apiVersion, await requestTopics(token, apiVersion))

  const [deliveryMethod, address] = await collectAddressAndMethod(flags.deliveryMethod, flags.address)

  const credentials = await getSecret(token, flags.sharedSecret)
  const secret = credentials.clientSecret as string

  const sample = await getWebhookSample(token, topic, apiVersion, deliveryMethod, address, secret)

  if (!sample.success) {
    consoleError(`Request errors:\n${formatErrors(sample.userErrors)}`)
    return
  }

  if (deliveryMethod === DELIVERY_METHOD.LOCALHOST) {
    const result = await triggerLocalWebhook(address, sample.samplePayload, sample.headers)

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

async function getSecret(token: string, sharedSecretFlag: string | undefined): Promise<AppCredentials> {
  if (sharedSecretFlag !== undefined && sharedSecretFlag.length > 0) {
    // Flag overwrites any other secret
    const credentials: AppCredentials = {clientSecret: sharedSecretFlag}
    return credentials
  }

  const manual = await renderConfirmationPrompt({
    message: `Do you want to set the client-secret manually?`,
    confirmationMessage: `Yes, I'll type it myself`,
    cancellationMessage: 'No, try to get it from the app config',
  })

  if (manual) {
    const credentials: AppCredentials = {}
    credentials.clientSecret = await collectSecret(sharedSecretFlag)
    return credentials
  }

  const localCredentials = await findInEnv()
  if (localCredentials.clientSecret !== undefined && localCredentials.clientSecret?.length > 0) {
    outputInfo('Reading client-secret from .env file')
    return localCredentials
  }

  const apiKey = await findApiKey(token)
  if (apiKey === undefined) {
    localCredentials.clientSecret = await collectSecret(sharedSecretFlag)
    return localCredentials
  }

  const appCredentials = await requestAppInfo(token, apiKey)
  if (appCredentials.clientSecret !== undefined && appCredentials.clientSecret.length > 0) {
    outputInfo('Reading client-secret from app config')
  } else {
    appCredentials.clientSecret = await collectSecret(sharedSecretFlag)
  }

  return appCredentials
}
