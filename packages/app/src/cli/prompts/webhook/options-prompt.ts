import {
  addressPrompt,
  apiVersionPrompt,
  deliveryMethodInstructions,
  deliveryMethodPrompt,
  clientSecretPrompt,
  topicPrompt,
} from './trigger.js'
import {
  DELIVERY_METHOD,
  deliveryMethodForAddress,
  isAddressAllowedForDeliveryMethod,
} from '../../services/webhook/trigger-options.js'
import {AbortError} from '@shopify/cli-kit/node/error'

/**
 * Flags collected from the command line parameters
 */
export interface WebhookTriggerFlags {
  topic?: string
  apiVersion?: string
  deliveryMethod?: string
  address?: string
  clientSecret?: string
}

export async function collectApiVersion(apiVersion: string | undefined, availableVersions: string[]): Promise<string> {
  const apiVersionPassed = flagPassed(apiVersion)

  if (apiVersionPassed) {
    const passedApiVersion = (apiVersion as string).trim()
    if (availableVersions.includes(passedApiVersion)) {
      return passedApiVersion
    }
    throw new AbortError(
      `Api Version '${passedApiVersion}' does not exist`,
      `Allowed values: ${availableVersions.join(', ')}`,
      ['Try again with a valid api-version value'],
    )
  }

  const promptedApiVersion = await apiVersionPrompt(availableVersions)

  return promptedApiVersion
}

export async function collectTopic(
  topic: string | undefined,
  apiVersion: string,
  availableTopics: string[],
): Promise<string> {
  const topicPassed = flagPassed(topic)

  if (topicPassed) {
    const passedTopic = equivalentTopic((topic as string).trim(), availableTopics)

    if (passedTopic === undefined) {
      throw new AbortError(
        `Topic '${passedTopic}' does not exist for ApiVersion '${apiVersion}'`,
        `Allowed values: ${availableTopics.join(', ')}`,
        ['Try again with a valid api-version - topic pair'],
      )
    }

    return passedTopic
  }

  if (availableTopics.length === 0) {
    throw new AbortError(`No topics found for '${apiVersion}'`)
  }
  const promptedTopic = await topicPrompt(availableTopics)

  return promptedTopic
}

export async function collectAddressAndMethod(
  deliveryMethod: string | undefined,
  address: string | undefined,
): Promise<[string, string]> {
  const methodWasPassed = flagPassed(deliveryMethod)
  const addressWasPassed = flagPassed(address)

  if (methodWasPassed && !validDeliveryMethodFlag(deliveryMethod)) {
    throw new AbortError(
      'Invalid Delivery Method passed',
      `${DELIVERY_METHOD.HTTP}, ${DELIVERY_METHOD.PUBSUB}, and ${DELIVERY_METHOD.EVENTBRIDGE} are allowed`,
      ['Try again with a valid delivery method'],
    )
  }
  // Method is valid

  let actualAddress = ''
  let actualMethod = ''

  if (methodWasPassed && addressWasPassed) {
    if (isAddressAllowedForDeliveryMethod(address as string, deliveryMethod as string)) {
      actualAddress = (address as string).trim()
      actualMethod = inferMethodFromAddress(actualAddress)
    } else {
      throw new AbortError(
        `Can't deliver your webhook payload to this address using '${deliveryMethod}'`,
        "Run 'shopify webhook trigger --address=<VALUE>' with a valid URL",
        deliveryMethodInstructions(deliveryMethod as string),
      )
    }
  }

  if (!methodWasPassed && addressWasPassed) {
    actualAddress = (address as string).trim()
    actualMethod = inferMethodFromAddress(actualAddress)
  }

  if (methodWasPassed && !addressWasPassed) {
    actualAddress = await addressPrompt(deliveryMethod as string)
    actualMethod = inferMethodFromAddress(actualAddress)
  }

  if (!methodWasPassed && !addressWasPassed) {
    const method = await deliveryMethodPrompt()
    actualAddress = await addressPrompt(method)
    actualMethod = inferMethodFromAddress(actualAddress)
  }

  return [actualMethod, actualAddress]
}

export async function collectSecret(clientSecret: string | undefined): Promise<string> {
  const secret = await useFlagOrPrompt(clientSecret, clientSecretPrompt)

  return secret
}

async function useFlagOrPrompt(value: string | undefined, prompt: () => Promise<string>): Promise<string> {
  return flagPassed(value) ? (value as string) : prompt()
}

function flagPassed(flag: string | undefined) {
  if (flag === undefined) {
    return false
  }

  return flag.length > 0
}

function validDeliveryMethodFlag(value: string | undefined): boolean {
  return value === DELIVERY_METHOD.HTTP || value === DELIVERY_METHOD.PUBSUB || value === DELIVERY_METHOD.EVENTBRIDGE
}

function inferMethodFromAddress(address: string): string {
  const method = deliveryMethodForAddress(address)
  if (method === undefined) {
    throw new AbortError(
      'No delivery method available for the address',
      `Use a valid address for ${DELIVERY_METHOD.HTTP}, ${DELIVERY_METHOD.PUBSUB} or ${DELIVERY_METHOD.EVENTBRIDGE}`,
    )
  }

  return method
}

function equivalentTopic(passedTopic: string, availableTopics: string[]): string | undefined {
  if (availableTopics.includes(passedTopic)) {
    return passedTopic
  }

  return availableTopics.find((elm) => elm.toUpperCase().replace('/', '_') === passedTopic)
}
