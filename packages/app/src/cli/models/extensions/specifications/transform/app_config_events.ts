import {prependApplicationUrl} from '../validation/url_prepender.js'
import {eventSubscriptionHandle, eventSubscriptions} from '../validation/events.js'
import {TransformRemoteToLocalOptions, configWithoutFirstClassFields} from '../../specification.js'
import {getPathValue} from '@shopify/cli-kit/common/object'
import {zod} from '@shopify/cli-kit/node/schema'
import {AbortError} from '@shopify/cli-kit/node/error'

/** Resolves relative URIs and removes the editing handle only from object-shaped modules. */
export function transformFromEventsConfig(content: object, appConfiguration?: object): object {
  const config = configWithoutFirstClassFields({...content})
  const events = readEvents(config)
  const subscription = events.subscription
  if (subscription === undefined || subscription === null) return config

  const appUrl = getPathValue<string>(appConfiguration ?? {}, 'application_url')
  const resolved = eventSubscriptions(subscription).map((sub) => {
    const {handle, ...rest} = sub
    const fields = Array.isArray(subscription) ? sub : rest
    return typeof sub.uri === 'string' ? {...fields, uri: prependApplicationUrl(sub.uri, appUrl)} : fields
  })
  if (resolved.length === 0) return config

  return {
    ...config,
    events: {...events, subscription: Array.isArray(subscription) ? resolved : resolved[0]},
  }
}

/** Restores local editing identity and pins effective versions before the generic module merge. */
export function transformToEventsConfig(content: object, options?: TransformRemoteToLocalOptions) {
  const events = readEvents(content)
  const subscription = events.subscription
  const subscriptions = eventSubscriptions(subscription)
  const cleanedSubscriptions = subscriptions.map((sub) => {
    const {identifier, handle, api_version: subscriptionApiVersion, ...rest} = sub
    const localHandle = Array.isArray(subscription)
      ? eventSubscriptionHandle(handle)
      : eventSubscriptionHandle(options?.module?.handle, 'module')
    const apiVersion = subscriptionApiVersion ?? events.api_version
    if (typeof apiVersion !== 'string' || apiVersion.length === 0) {
      throw new AbortError(`Events subscription "${localHandle}" is missing an effective API version.`)
    }
    // Every entry needs its effective version: another module can overwrite the root default during merge.
    return {...rest, handle: localHandle, api_version: apiVersion}
  })

  return {
    events: {
      ...(events.api_version === undefined ? {} : {api_version: events.api_version}),
      ...(Array.isArray(subscription) || cleanedSubscriptions.length > 0 ? {subscription: cleanedSubscriptions} : {}),
    },
  }
}

function readEvents(content: object): Record<string, unknown> {
  const events = getPathValue(content, 'events')
  if (events === undefined || events === null) return {}
  const result = zod.record(zod.unknown()).safeParse(events)
  if (!result.success) throw new AbortError('Events configuration must be an object.')
  return result.data
}
