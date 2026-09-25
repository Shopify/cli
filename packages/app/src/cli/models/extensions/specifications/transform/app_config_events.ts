import {prependApplicationUrl} from '../validation/url_prepender.js'
import {ConfigurationModule, configWithoutFirstClassFields} from '../../specification.js'
import {getPathValue} from '@shopify/cli-kit/common/object'
import {AbortError} from '@shopify/cli-kit/node/error'
import {zod} from '@shopify/cli-kit/node/schema'

const SubscriptionShape = zod.record(zod.unknown()).refine((value) => Object.keys(value).length > 0)
const EventsShape = zod
  .object({
    api_version: zod.string().min(1).optional(),
    subscription: zod.union([SubscriptionShape, zod.array(SubscriptionShape)]).nullish(),
  })
  .passthrough()

export function eventSubscriptionHandle(handle: unknown): string {
  if (typeof handle !== 'string' || !/^[a-zA-Z0-9_-]{1,50}$/.test(handle)) {
    throw new AbortError(
      'Events subscription identity must be a handle of 1–50 letters, numbers, hyphens or underscores.',
    )
  }
  return handle
}

/** Resolve relative URIs, removing local editing identity only from outgoing object subscriptions. */
export function transformFromEventsConfig(content: object, appConfiguration?: object): object {
  const config = configWithoutFirstClassFields({...content})
  const events = readEvents(config)
  if (!events?.subscription) return config

  const appUrl = appConfiguration && getPathValue<string>(appConfiguration, 'application_url')
  const resolve = (subscription: Record<string, unknown>) => ({
    ...subscription,
    ...(typeof subscription.uri === 'string' ? {uri: prependApplicationUrl(subscription.uri, appUrl)} : {}),
  })
  let subscription
  if (Array.isArray(events.subscription)) {
    subscription = events.subscription.map(resolve)
  } else {
    const {handle, ...payload} = events.subscription
    subscription = resolve(payload)
  }

  return {...config, events: {...events, subscription}}
}

/** Reconstruct the entire Events section before compacting per-subscription versions against one default. */
export function aggregateEventsConfigurations(modules: ReadonlyArray<ConfigurationModule>) {
  const defaults: string[] = []
  const subscriptions: Record<string, unknown>[] = []
  let hasSubscriptionList = false

  for (const module of modules) {
    const events = readEvents(module.config)
    if (!events) continue
    if (events.api_version !== undefined) defaults.push(events.api_version)
    if (events.subscription == null) continue
    hasSubscriptionList = true
    const isList = Array.isArray(events.subscription)
    const entries = Array.isArray(events.subscription) ? events.subscription : [events.subscription]
    if (entries.length > 0 && events.api_version === undefined) {
      throw new AbortError("Can't reconstruct Events subscriptions without events.api_version on their module.")
    }
    for (const entry of entries) {
      const {identifier, handle, api_version: override, ...payload} = entry
      if (override !== undefined && (typeof override !== 'string' || override.length === 0)) {
        throw new AbortError('Events subscription api_version must be a nonempty string.')
      }
      subscriptions.push({
        ...payload,
        handle: eventSubscriptionHandle(isList ? handle : module.handle),
        api_version: override ?? events.api_version,
      })
    }
  }

  // Lexical ordering chooses a stable representation, not the newest API release.
  const apiVersion = defaults.sort()[0]
  const compacted = subscriptions.map(({api_version: version, ...subscription}) =>
    version === apiVersion ? subscription : {...subscription, api_version: version},
  )
  return {
    events: {
      ...(apiVersion === undefined ? {} : {api_version: apiVersion}),
      ...(hasSubscriptionList ? {subscription: compacted} : {}),
    },
  }
}

function readEvents(content: object) {
  const events = getPathValue<unknown>(content, 'events')
  if (events == null) return undefined
  const parsed = EventsShape.safeParse(events)
  if (!parsed.success) {
    throw new AbortError(
      'Invalid Events configuration: expected an events table and a subscription object or array of nonempty objects.',
    )
  }
  return parsed.data
}
