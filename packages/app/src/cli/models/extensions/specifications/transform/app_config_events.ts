import {prependApplicationUrl} from '../validation/url_prepender.js'
import {CurrentAppConfiguration} from '../../../app/app.js'
import {getPathValue} from '@shopify/cli-kit/common/object'

interface EventSubscription {
  // The events schema is untyped locally, so a subscription may be missing its uri
  // or carry a non-string value. Such subscriptions are left for the server to reject.
  uri?: unknown
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
  const resolved = wrapSubscriptions(subscription).map((sub) =>
    typeof sub.uri === 'string' ? {...sub, uri: prependApplicationUrl(sub.uri, appUrl)} : sub,
  )

  return {
    ...eventsConfig,
    events: {
      ...eventsConfig.events,
      subscription: Array.isArray(subscription) ? resolved : resolved[0],
    },
  }
}

interface RemoteEventSubscription {
  identifier: string
  api_version?: string
  [key: string]: unknown
}

/**
 * Transforms the events config from remote to local format.
 * Strips the server-managed 'identifier' field from subscriptions, and the
 * per-subscription 'api_version' when it only echoes the events default.
 */
export function transformToEventsConfig(content: object) {
  const eventsConfig = getPathValue(content, 'events') as {
    api_version: string
    subscription: RemoteEventSubscription | RemoteEventSubscription[]
  }
  const apiVersion = getPathValue<string>(eventsConfig, 'api_version')
  const subscription = getPathValue<RemoteEventSubscription | RemoteEventSubscription[] | null>(
    eventsConfig,
    'subscription',
  )

  // The server always includes identifier, and materializes the events default
  // api_version onto every subscription. Both are derived, so they are stripped
  // for the local TOML; an api_version that differs from the default is a real
  // override and is kept. Single-subscription modules are normalized to a
  // one-element array so that merging multiple modules accumulates a single
  // subscription list.
  // The remote payload may carry null as well as omit the field entirely.
  const cleanedSubscriptions = subscription
    ? wrapSubscriptions(subscription).map((sub) => {
        const {identifier, api_version: subscriptionApiVersion, ...rest} = sub
        const overridesDefault = subscriptionApiVersion !== undefined && subscriptionApiVersion !== apiVersion
        return overridesDefault ? {...rest, api_version: subscriptionApiVersion} : rest
      })
    : undefined

  const events =
    (apiVersion ?? cleanedSubscriptions) ? {api_version: apiVersion, subscription: cleanedSubscriptions} : {}

  return {events}
}

function wrapSubscriptions<T>(subscription: T | T[]): T[] {
  return Array.isArray(subscription) ? subscription : [subscription]
}
