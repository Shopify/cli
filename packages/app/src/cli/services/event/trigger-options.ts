export const DELIVERY_METHOD = {
  LOCALHOST: 'localhost',
  HTTP: 'http',
  PUBSUB: 'google-pub-sub',
  EVENTBRIDGE: 'event-bridge',
}

const PROTOCOL = {
  LOCALHOST: new RegExp('^http:'),
  HTTP: new RegExp('^https:'),
  PUBSUB: new RegExp('^pubsub:'),
  EVENTBRIDGE: new RegExp('^arn:aws:events:'),
}

/**
 * Transformed flags
 */
export interface EventTriggerOptions {
  topic: string
  apiVersion: string
  deliveryMethod: string
  sharedSecret: string
  address: string
}

/**
 * Detect which delivery-method an address belongs to
 *
 * @param address - A target endpoint
 * @returns A DELIVERY_METHOD or undefined if none found
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
