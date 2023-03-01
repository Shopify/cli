import {findApiKey, findInEnv, requestAppInfo} from './find-app-info.js'
import {requestApiVersions} from './request-api-versions.js'
import {requestTopics} from './request-topics.js'
import {parseAddressFlag, parseTopicFlag} from './trigger-flags.js'
import {isValueSet} from './trigger.js'
import {
  addressPrompt,
  apiVersionPrompt,
  clientSecretPrompt,
  deliveryMethodPrompt,
  topicPrompt,
} from '../../prompts/webhook/trigger.js'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {outputInfo} from '@shopify/cli-kit/node/output'

/**
 * Collects a secret using a fallback mechanism:
 *  - Use if passed as flag
 *  - If manual: prompt and use
 *  - If automatic:
 *    - Get from .env
 *    - Get from Partners (possible prompts for organization and app)
 *    - prompt and use
 *
 * @param token - Partners session token
 * @param secret - secret flag
 * @returns client-secret
 */
export async function collectSecret(token: string, secret: string | undefined): Promise<string> {
  if (isValueSet(secret)) {
    return secret as string
  }

  const automatic = await renderConfirmationPrompt({
    message: `Should we automatically populate the client-secret for you using app settings?`,
    confirmationMessage: `Yes, try to get it from the configuration`,
    cancellationMessage: "No, I'll type it myself",
  })

  if (!automatic) {
    const manualSecret = await clientSecretPrompt()
    return manualSecret
  }

  const localCredentials = await findInEnv()
  if (isValueSet(localCredentials.clientSecret)) {
    outputInfo('Reading client-secret from .env file')
    return localCredentials.clientSecret as string
  }

  const apiKey = await findApiKey(token)
  if (apiKey === undefined) {
    localCredentials.clientSecret = await clientSecretPrompt()
    return localCredentials.clientSecret
  }

  const appCredentials = await requestAppInfo(token, apiKey)
  if (isValueSet(appCredentials.clientSecret)) {
    outputInfo('Reading client-secret from app settings in Partners')
  } else {
    appCredentials.clientSecret = await clientSecretPrompt()
  }

  return appCredentials.clientSecret as string
}

/**
 * Returns passed apiVersion or prompts for an existing one
 *
 * @param token - Partners session token
 * @param apiVersion - VALID or undefined api-version
 * @returns api-version
 */
export async function collectApiVersion(token: string, apiVersion: string | undefined): Promise<string> {
  const selected = isValueSet(apiVersion)
    ? (apiVersion as string)
    : await apiVersionPrompt(await requestApiVersions(token))

  return selected
}

/**
 * Returns passed topic if valid or prompts for an existing one
 *
 * @param token - Partners session token
 * @param apiVersion - VALID api-version
 * @param topic - topic or undefined
 * @returns topic
 */
export async function collectTopic(token: string, apiVersion: string, topic: string | undefined): Promise<string> {
  if (isValueSet(topic)) {
    return parseTopicFlag(topic as string, apiVersion, await requestTopics(token, apiVersion))
  }

  const selected = await topicPrompt(await requestTopics(token, apiVersion))

  return selected
}

/**
 * Expects either undefined deliveryMethod - address pairs, undefined address or a valid pair
 *
 * @param deliveryMethod - Valid delivery method
 * @param address - Valid address
 * @returns [deliveryMethod, address]
 */
export async function collectAddressAndMethod(
  deliveryMethod: string | undefined,
  address: string | undefined,
): Promise<[string, string]> {
  let actualAddress = ''

  if (isValueSet(deliveryMethod) && isValueSet(address)) {
    actualAddress = address as string
  }

  if (isValueSet(deliveryMethod) && !isValueSet(address)) {
    // Prompt only for addresses that are allowed for deliveryMethod
    actualAddress = await addressPrompt(deliveryMethod as string)
  }

  if (!isValueSet(deliveryMethod) && !isValueSet(address)) {
    // Ask for both
    const method = await deliveryMethodPrompt()
    actualAddress = await addressPrompt(method)
  }

  // Check if valid combination
  const [finalAddress, actualMethod] = parseAddressFlag(actualAddress)

  return [actualMethod, finalAddress]
}
