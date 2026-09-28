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
 * Strips the server-managed 'identifier' field from subscriptions, and the
 * subscription 'api_version' when it matches the events default.
 */
export function transformToEventsConfig(content: object) {
  const eventsConfig = getPathValue(content, 'events') as {api_version: string; subscription: object[]}
  const apiVersion = getPathValue(eventsConfig, 'api_version') as string
  const subscription = getPathValue(eventsConfig, 'subscription') as {identifier: string; api_version?: string}[]

  // Server adds identifier and fills [events].api_version into subscriptions that omit it
  const cleanedSubscriptions = subscription?.map((sub) => {
    const {identifier, api_version: subscriptionApiVersion, ...rest} = sub
    const overridesDefault = subscriptionApiVersion !== undefined && subscriptionApiVersion !== apiVersion
    return overridesDefault ? {...rest, api_version: subscriptionApiVersion} : rest
  })

  const events =
    (apiVersion ?? cleanedSubscriptions) ? {api_version: apiVersion, subscription: cleanedSubscriptions} : {}

  return {events}
}
