import {prependApplicationUrl} from '../validation/url_prepender.js'
import {CurrentAppConfiguration} from '../../../app/app.js'
import {getPathValue} from '@shopify/cli-kit/common/object'

interface EventSubscription {
  uri: string
  [key: string]: unknown
}

interface EventsConfig {
  events?: {
    api_version?: string
    subscription?: EventSubscription | EventSubscription[]
  }
}

/**
 * Transforms the events config from local to remote format.
 * Resolves relative URIs (starting with /) by prepending the application_url.
 * During dev, application_url is set to the tunnel URL, ensuring events
 * are delivered to the correct endpoint.
 */
export function transformFromEventsConfig(content: object, appConfiguration?: object) {
  const eventsConfig = content as EventsConfig

  if (!eventsConfig.events?.subscription) {
    return content
  }

  let appUrl: string | undefined
  if (appConfiguration && 'application_url' in appConfiguration) {
    appUrl = (appConfiguration as CurrentAppConfiguration)?.application_url
  }

  const subscription = eventsConfig.events.subscription
  const resolved = wrapSubscriptions(subscription).map((sub) => ({
    ...sub,
    uri: prependApplicationUrl(sub.uri, appUrl),
  }))

  return {
    ...eventsConfig,
    events: {
      ...eventsConfig.events,
      subscription: Array.isArray(subscription) ? resolved : resolved[0],
    },
  }
}

/**
 * Transforms the events config from remote to local format.
 * Strips the server-managed 'identifier' field from subscriptions.
 */
export function transformToEventsConfig(content: object) {
  const eventsConfig = getPathValue(content, 'events') as {
    api_version: string
    subscription: {identifier: string} | {identifier: string}[]
  }
  const apiVersion = getPathValue(eventsConfig, 'api_version')
  const subscription = getPathValue<{identifier: string} | {identifier: string}[]>(eventsConfig, 'subscription')

  // Server always includes identifier - strip it for local TOML.
  // Single-subscription modules are normalized to a one-element array so that
  // merging multiple modules accumulates a single subscription list.
  const cleanedSubscriptions =
    subscription === undefined
      ? undefined
      : wrapSubscriptions(subscription).map((sub) => {
          const {identifier, ...rest} = sub
          return rest
        })

  const events =
    (apiVersion ?? cleanedSubscriptions) ? {api_version: apiVersion, subscription: cleanedSubscriptions} : {}

  return {events}
}

function wrapSubscriptions<T>(subscription: T | T[]): T[] {
  return Array.isArray(subscription) ? subscription : [subscription]
}
