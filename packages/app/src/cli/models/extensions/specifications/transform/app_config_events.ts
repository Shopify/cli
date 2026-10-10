import {prependApplicationUrl} from '../validation/url_prepender.js'
import {MAX_EXTENSION_HANDLE_LENGTH} from '../../schemas.js'
import {CurrentAppConfiguration} from '../../../app/app.js'
import {RemoteToLocalTransformOptions} from '../../specification.js'
import {getPathValue} from '@shopify/cli-kit/common/object'
import {slugify} from '@shopify/cli-kit/common/string'

interface EventSubscription {
  // The events schema is untyped locally, so a subscription may be missing its uri
  // or carry a non-string value. Such subscriptions are left for the server to reject.
  uri?: unknown
  [key: string]: unknown
}

interface EventsConfig {
  handle?: string
  events?: {
    api_version?: string
    subscription?: EventSubscription | EventSubscription[]
  }
}

/**
 * Transforms the events config from local to remote format.
 * Resolves relative URIs (starting with /) by prepending the application_url.
 * A single-subscription module carries its handle on the module, which the manifest
 * sends separately, so it is dropped from the config payload. In the list shape the
 * handle is kept on every entry, as Core's contract requires.
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

  const {handle: _, ...configWithoutHandle} = eventsConfig
  const subscription = eventsConfig.events.subscription
  const isSingleSubscription = !Array.isArray(subscription)
  const resolved = wrapSubscriptions(subscription).map((sub) => {
    const {handle: __, ...subWithoutHandle} = sub
    const payload = isSingleSubscription ? subWithoutHandle : sub
    return typeof payload.uri === 'string' ? {...payload, uri: prependApplicationUrl(payload.uri, appUrl)} : payload
  })

  return {
    ...configWithoutHandle,
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
  topic: string
  actions: string[]
  [key: string]: unknown
}

/**
 * Transforms one events module from remote to local format.
 * Strips the server-managed 'identifier' field, and the per-subscription
 * 'api_version' when it matches the module default. Single-subscription
 * objects are normalized to a one-element array. The platform keeps their handle
 * on the module, not in the subscription, so the module handle is restored when given.
 * Without one, the handle is derived from the topic and actions.
 */
export function transformToEventsConfig(content: object, options?: RemoteToLocalTransformOptions) {
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
    // The platform treats the module handle as the subscription's identity: the runtime, the uid
    // and the identifier are all derived from it, and a nested handle is rejected on write. A
    // nested handle only survives on older versions, so it must not win over the module handle.
    const handle = options?.handle ?? subscription.handle ?? handleFromSubscriptionData(subscription)
    cleanedSubscriptions = [clean({...subscription, handle})]
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

function handleFromSubscriptionData(subscription: RemoteEventSubscription): string {
  const handle = slugify([subscription.topic, ...subscription.actions].join('-'))
  return handle.slice(0, MAX_EXTENSION_HANDLE_LENGTH).replace(/-$/, '')
}

function wrapSubscriptions<T>(subscription: T | T[]): T[] {
  return Array.isArray(subscription) ? subscription : [subscription]
}
