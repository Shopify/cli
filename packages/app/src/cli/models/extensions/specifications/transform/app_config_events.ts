import {prependApplicationUrl} from '../validation/url_prepender.js'
import {CurrentAppConfiguration} from '../../../app/app.js'
import {getPathValue} from '@shopify/cli-kit/common/object'

interface EventsConfig {
  events?: {
    api_version?: string
    subscription?: {uri: string; [key: string]: unknown}[]
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

  return {
    ...eventsConfig,
    events: {
      ...eventsConfig.events,
      subscription: eventsConfig.events.subscription.map((sub) => ({
        ...sub,
        uri: prependApplicationUrl(sub.uri, appUrl),
      })),
    },
  }
}

/**
 * Transforms the events config from remote to local format.
 * Strips the server-managed 'identifier' field from subscriptions.
 *
 * The server stores events modules in two shapes: a legacy aggregate module
 * whose subscription is a list, and one module per subscription whose
 * subscription is a single object. Both are normalized to a list here so that
 * multiple single-subscription modules deep-merge back into the TOML
 * subscription array.
 */
export function transformToEventsConfig(content: object) {
  const eventsConfig = getPathValue(content, 'events') as {
    api_version: string
    subscription: object[] | object
  }
  const apiVersion = getPathValue(eventsConfig, 'api_version')
  const subscription = normalizeSubscriptions(getPathValue(eventsConfig, 'subscription'))

  // Server always includes identifier - strip it for local TOML
  const cleanedSubscriptions = subscription?.map((sub) => {
    const {identifier, ...rest} = sub
    return rest
  })

  const events =
    (apiVersion ?? cleanedSubscriptions) ? {api_version: apiVersion, subscription: cleanedSubscriptions} : {}

  return {events}
}

function normalizeSubscriptions(subscription: unknown): {identifier?: string}[] | undefined {
  if (subscription === undefined) return undefined
  if (Array.isArray(subscription)) return subscription as {identifier?: string}[]
  return [subscription as {identifier?: string}]
}
