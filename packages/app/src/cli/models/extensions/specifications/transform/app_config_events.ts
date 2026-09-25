import {prependApplicationUrl} from '../validation/url_prepender.js'
import {CurrentAppConfiguration} from '../../../app/app.js'
import {configWithoutFirstClassFields} from '../../specification.js'
import {getPathValue} from '@shopify/cli-kit/common/object'
import {AbortError} from '@shopify/cli-kit/node/error'
import {zod} from '@shopify/cli-kit/node/schema'

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
export function transformFromEventsConfig(content: object, appConfiguration?: object): object {
  const config = configWithoutFirstClassFields({...content})
  const eventsConfig = config as EventsConfig

  if (!eventsConfig.events?.subscription) {
    return config
  }

  let appUrl: string | undefined
  if (appConfiguration && 'application_url' in appConfiguration) {
    appUrl = (appConfiguration as CurrentAppConfiguration)?.application_url
  }

  const subscription = eventsConfig.events.subscription
  const resolved = wrapSubscriptions(subscription).map((sub) => {
    const {handle, ...withoutHandle} = sub
    return {
      ...(Array.isArray(subscription) ? sub : withoutHandle),
      ...(typeof sub.uri === 'string' ? {uri: prependApplicationUrl(sub.uri, appUrl)} : {}),
    }
  })

  return {
    ...eventsConfig,
    events: {
      ...eventsConfig.events,
      subscription: Array.isArray(subscription) ? resolved : resolved[0],
    },
  }
}

// Validate only what reconstruction needs, not the server's full subscription schema.
const SubscriptionShape = zod.object({api_version: zod.string().min(1).optional()}).passthrough()
const EventsShape = zod.object({
  api_version: zod.string().min(1).optional(),
  subscription: zod.union([SubscriptionShape, zod.array(SubscriptionShape)]).nullish(),
})

interface LocalEventsConfiguration {
  api_version?: string
  subscription?: (zod.infer<typeof SubscriptionShape> & {handle: string})[]
}

interface EventsAppConfiguration {
  events?: LocalEventsConfiguration
  [key: string]: unknown
}

/** Exact spelling is identity; Core checks uniqueness case-insensitively. */
export function eventSubscriptionHandle(handle: unknown): string {
  if (typeof handle !== 'string' || !/^[a-zA-Z0-9_-]{1,50}$/.test(handle)) {
    throw new AbortError(
      'Events subscription identity requires a handle of 1–50 letters, digits, underscores or hyphens.',
    )
  }
  return handle
}

/**
 * Events-owned envelope adapter. Object identity cannot be reconstructed from config alone.
 * Keep this at both app-config boundaries, where the enclosing module is still available.
 */
export function mergeEventsModuleConfiguration(
  appConfig: EventsAppConfiguration,
  module: {readonly config: object; readonly handle?: unknown},
): EventsAppConfiguration {
  const parsed = EventsShape.safeParse(getPathValue(module.config, 'events') ?? {})
  if (!parsed.success) throw new AbortError(`Invalid Events configuration: ${parsed.error.message}`)
  const {api_version: apiVersion, subscription} = parsed.data
  const incoming =
    subscription == null
      ? []
      : wrapSubscriptions(subscription).map((sub) => {
          const {identifier, handle, api_version: override, ...rest} = sub
          const effectiveVersion = override ?? apiVersion
          if (effectiveVersion === undefined)
            throw new AbortError('Events subscription is missing its effective API version.')
          return {
            ...rest,
            handle: eventSubscriptionHandle(Array.isArray(subscription) ? handle : module.handle),
            api_version: effectiveVersion,
          }
        })
  const subscriptions = [...(appConfig.events?.subscription ?? []), ...incoming]
  const handles = new Set<string>()
  for (const sub of subscriptions) {
    const key = sub.handle.toLowerCase()
    if (handles.has(key)) throw new AbortError(`Duplicate Events subscription handle: ${sub.handle}`)
    handles.add(key)
  }

  // One TOML default represents many module defaults. Materialize each entry's effective
  // version before choosing a deterministic default so merge order cannot change delivery.
  const defaults = [appConfig.events?.api_version, apiVersion].filter((value): value is string => value !== undefined)
  const defaultVersion = defaults.sort()[0]
  return {
    ...appConfig,
    events: {
      ...(defaultVersion === undefined ? {} : {api_version: defaultVersion}),
      ...(subscriptions.length > 0 || appConfig.events?.subscription !== undefined || Array.isArray(subscription)
        ? {subscription: subscriptions}
        : {}),
    },
  }
}

/** Config-only readback supports lists; object readback requires the envelope adapter. */
export function transformToEventsConfig(content: object) {
  return mergeEventsModuleConfiguration({}, {config: content})
}

function wrapSubscriptions<T>(subscription: T | T[]): T[] {
  return Array.isArray(subscription) ? subscription : [subscription]
}
