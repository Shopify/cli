import {AbortError} from '@shopify/cli-kit/node/error'

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
  const expectedDeliveryMethod = deliveryMethodForAddress(address)
  if (expectedDeliveryMethod === DELIVERY_METHOD.LOCALHOST && deliveryMethod === DELIVERY_METHOD.HTTP) return true

  return expectedDeliveryMethod === deliveryMethod
}

function isLocal(address: string): boolean {
  if (!PROTOCOL.LOCALHOST.test(address)) return false

  const url = new URL(address.toLowerCase())
  return url.hostname === 'localhost'
}

/**
 * check if the address is allowed for the delivery method
 *
 * @param address - Address
 * @param deliveryMethod - Delivery Method
 * @returns [address, deliveryMethod]
 */
export function validateAddressMethod(address: string, deliveryMethod: string): [string, string] {
  if (!isAddressAllowedForDeliveryMethod(address, deliveryMethod)) {
    throw new AbortError(
      `Can't deliver your webhook payload to this address using '${deliveryMethod}'`,
      'Use a valid URL for address',
      deliveryMethodInstructions(deliveryMethod),
    )
  }
  let method = deliveryMethod
  if (isLocal(address)) {
    method = DELIVERY_METHOD.LOCALHOST
  }

  return [address.trim(), method]
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

export function parseApiVersionFlag(passedVersion: string, availableVersions: string[]): string {
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

/**
 * Infer the delivery method from address
 *
 * @param address - Address
 * @returns deliveryMethod or undefined
 */
export function deliveryMethodForAddress(address: string | undefined): string | undefined {
  if (!address) return undefined

  if (PROTOCOL.PUBSUB.test(address)) {
    return DELIVERY_METHOD.PUBSUB
  }

  if (PROTOCOL.EVENTBRIDGE.test(address)) {
    return DELIVERY_METHOD.EVENTBRIDGE
  }

  if (isLocal(address)) {
    return DELIVERY_METHOD.LOCALHOST
  }

  if (PROTOCOL.HTTP.test(address)) {
    return DELIVERY_METHOD.HTTP
  }

  return undefined
}
