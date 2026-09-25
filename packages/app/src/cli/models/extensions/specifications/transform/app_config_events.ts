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

interface RemoteEventsModule {
  api_version?: string
  subscription?: RemoteEventSubscription | RemoteEventSubscription[] | null
}

interface RemoteEventSubscription {
  identifier?: string
  handle?: string
  api_version?: string
  [key: string]: unknown
}

/**
 * Transforms one events module from remote to local format.
 * Strips the server-managed 'identifier' field, and the per-subscription
 * 'api_version' when it matches the module default. Single-subscription
 * objects are normalized to a one-element array.
 */
export function transformToEventsConfig(content: object, moduleHandle?: string) {
  const {api_version: apiVersion, subscription} = getPathValue<RemoteEventsModule>(content, 'events') ?? {}

  const clean = (sub: RemoteEventSubscription) => {
    const {identifier: _, api_version: subApiVersion, ...rest} = sub
    const overridesDefault = subApiVersion !== undefined && subApiVersion !== apiVersion
    return overridesDefault ? {...rest, api_version: subApiVersion} : rest
  }

  let cleanedSubscriptions: object[] | undefined
  if (Array.isArray(subscription)) {
    cleanedSubscriptions = subscription.map(clean)
  } else if (subscription) {
    const handle = subscription.handle ?? moduleHandle
    cleanedSubscriptions = [clean(handle ? {...subscription, handle} : subscription)]
  }

  const events: {api_version?: string; subscription?: object[]} = {}
  if (apiVersion !== undefined) {
    events.api_version = apiVersion
  }
  if (cleanedSubscriptions !== undefined) {
    events.subscription = cleanedSubscriptions
  }

  return {events}
}

function wrapSubscriptions<T>(subscription: T | T[]): T[] {
  return Array.isArray(subscription) ? subscription : [subscription]
}
