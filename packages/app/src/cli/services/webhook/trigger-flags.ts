import {requestApiVersions} from './request-api-versions.js'
import {requestTopics} from './request-topics.js'
import {isValueSet} from './trigger.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AbortError} from '@shopify/cli-kit/node/error'

export interface WebhookTriggerFlags {
  topic?: string
  apiVersion?: string
  deliveryMethod?: string
  address?: string
  clientSecret?: string
  developerPlatformClient?: DeveloperPlatformClient
}

export const DELIVERY_METHOD = {
  LOCALHOST: 'localhost',
  HTTP: 'http',
  PUBSUB: 'google-pub-sub',
  EVENTBRIDGE: 'event-bridge',
}

const PROTOCOL = {
  LOCALHOST: new RegExp('^http:', 'i'),
  HTTP: new RegExp('^https:', 'i'),
  PUBSUB: new RegExp('^pubsub:'),
  EVENTBRIDGE: new RegExp('^arn:aws:events:'),
}

/**
 * Checks whether an address and a delivery method are compatible
 *
 * @param address - A target endpoint
 * @param deliveryMethod - An existing delivery-method
 * @returns true if compatible (eg: pubsub://projectid/topicid and google-pub-sub), false otherwise
 */
export function isAddressAllowedForDeliveryMethod(address: string, deliveryMethod: string): boolean {
  if (deliveryMethod === DELIVERY_METHOD.PUBSUB) {
    return PROTOCOL.PUBSUB.test(address)
  }

  if (deliveryMethod === DELIVERY_METHOD.EVENTBRIDGE) {
    return PROTOCOL.EVENTBRIDGE.test(address)
  }

  if (deliveryMethod === DELIVERY_METHOD.HTTP && isAnyHttp(address)) {
    if (isLocal(address)) {
      return true
    }
    return PROTOCOL.HTTP.test(address)
  }

  return false
}

function isLocal(address: string): boolean {
  const url = new URL(address.toLowerCase())
  return url.hostname === 'localhost'
}

function isAnyHttp(address: string): boolean {
  return PROTOCOL.LOCALHOST.test(address) || PROTOCOL.HTTP.test(address)
}

/**
 * Returns valid address - method pairs from flags
 *
 * @param flags - Command flags
 * @returns [deliveryMethod, address]
 */
export function parseAddressAndMethod(flags: WebhookTriggerFlags): [string | undefined, string | undefined] {
  let deliveryMethod
  let address
  const methodWasPassed = isValueSet(flags.deliveryMethod)
  if (methodWasPassed) {
    deliveryMethod = parseDeliveryMethodFlag(flags.deliveryMethod as string)
  }

  const addressWasPassed = isValueSet(flags.address)
  if (addressWasPassed) {
    if (methodWasPassed) {
      validateAddressMethod(flags.address as string, flags.deliveryMethod as string)
    }
    ;[address, deliveryMethod] = parseAddressFlag(flags.address as string)
  }

  return [deliveryMethod, address]
}

/**
 * Returns valid api-version - topic pairs
 *
 * @param developerPlatformClient - The client to access the platform API
 * @param flags - Command flags
 * @returns [apiVersion, topic]
 */
export async function parseVersionAndTopic(
  developerPlatformClient: DeveloperPlatformClient,
  flags: WebhookTriggerFlags,
): Promise<[string | undefined, string | undefined]> {
  let topic
  let apiVersion
  const versionWasPassed = isValueSet(flags.apiVersion)
  if (versionWasPassed) {
    apiVersion = parseApiVersionFlag(flags.apiVersion as string, await requestApiVersions(developerPlatformClient))
  }
  const topicWasPassed = isValueSet(flags.topic)
  if (topicWasPassed && versionWasPassed) {
    topic = parseTopicFlag(
      flags.topic as string,
      flags.apiVersion as string,
      await requestTopics(developerPlatformClient, flags.apiVersion as string),
    )
  } else if (topicWasPassed) {
    topic = flags.topic
  }

  return [apiVersion, topic]
}

function parseDeliveryMethodFlag(method: string): string {
  if (method !== DELIVERY_METHOD.HTTP && method !== DELIVERY_METHOD.PUBSUB && method !== DELIVERY_METHOD.EVENTBRIDGE) {
    throw new AbortError(
      'Invalid Delivery Method passed',
      `${DELIVERY_METHOD.HTTP}, ${DELIVERY_METHOD.PUBSUB}, and ${DELIVERY_METHOD.EVENTBRIDGE} are allowed`,
      ['Try again with a valid delivery method'],
    )
  }

  return method
}

/**
 * check if the address is allowed for the delivery method
 *
 * @param address - Address
 * @param deliveryMethod - Delivery Method
 * @returns true or Exception
 */
export function validateAddressMethod(address: string, deliveryMethod: string): boolean {
  if (!isAddressAllowedForDeliveryMethod(address, deliveryMethod)) {
    throw new AbortError(
      `Can't deliver your webhook payload to this address using '${deliveryMethod}'`,
      'Use a valid URL for address',
      deliveryMethodInstructions(deliveryMethod),
    )
  }

  return true
}

function deliveryMethodInstructions(method: string): string[] {
  if (method === DELIVERY_METHOD.HTTP) {
    return [
      `For remote HTTP testing, use a URL that starts with https://`,
      `For local HTTP testing, use http://localhost:{port}/{url-path}`,
    ]
  }
  if (method === DELIVERY_METHOD.PUBSUB) {
    return [`For Google Pub/Sub, use pubsub://{project-id}:{topic-id}`]
  }
  if (method === DELIVERY_METHOD.EVENTBRIDGE) {
    return [`For Amazon EventBridge, use an Amazon Resource Name (ARN) starting with arn:aws:events:`]
  }

  return []
}

/**
 * Check if the address is valid and return a valid address - method pair
 *
 * @param address - Address
 * @returns [address, deliveryMethod]
 */
export function parseAddressFlag(address: string): [string, string] {
  const method = deliveryMethodForAddress(address)
  if (method === undefined) {
    throw new AbortError(
      'No delivery method available for the address',
      `Use a valid address for ${DELIVERY_METHOD.HTTP}, ${DELIVERY_METHOD.PUBSUB} or ${DELIVERY_METHOD.EVENTBRIDGE}`,
    )
  }

  return [address.trim(), method]
}

/**
 * Infer the delivery method from address
 *
 * @param address - Address
 * @returns deliveryMethod or undefined
 */
export function deliveryMethodForAddress(address: string): string | undefined {
  if (PROTOCOL.PUBSUB.test(address)) {
    return DELIVERY_METHOD.PUBSUB
  }

  if (PROTOCOL.EVENTBRIDGE.test(address)) {
    return DELIVERY_METHOD.EVENTBRIDGE
  }

  if (isAnyHttp(address) && isLocal(address)) {
    return DELIVERY_METHOD.LOCALHOST
  }

  if (PROTOCOL.HTTP.test(address)) {
    return DELIVERY_METHOD.HTTP
  }

  return undefined
}

function parseApiVersionFlag(passedVersion: string, availableVersions: string[]): string {
  if (availableVersions.includes(passedVersion)) {
    return passedVersion
  }

  throw new AbortError(
    `Api Version '${passedVersion}' does not exist`,
    `Allowed values: ${availableVersions.join(', ')}`,
    ['Try again with a valid api-version value'],
  )
}

/**
 * topic if available in the topics list (transformed to undercase-slash if passed as GraphQL event name)
 *
 * @param passedTopic - Topic
 * @param apiVersion - ApiVersion for Exception message purposes
 * @param availableTopics - List of available topics
 * @returns topic
 */
export function parseTopicFlag(passedTopic: string, apiVersion: string, availableTopics: string[]): string {
  if (availableTopics.length === 0) {
    throw new AbortError(`No topics found for '${apiVersion}'`)
  }
  const translatedTopic = equivalentTopic(passedTopic.trim(), availableTopics)

  if (translatedTopic === undefined) {
    throw new AbortError(
      `Topic '${passedTopic}' does not exist for ApiVersion '${apiVersion}'`,
      `Allowed values: ${availableTopics.join(', ')}`,
      ['Try again with a valid api-version - topic pair'],
    )
  }

  return translatedTopic
}

function equivalentTopic(passedTopic: string, availableTopics: string[]): string | undefined {
  if (availableTopics.includes(passedTopic)) {
    return passedTopic
  }

  return availableTopics.find((elm) => elm.toUpperCase().replace('/', '_') === passedTopic)
}
