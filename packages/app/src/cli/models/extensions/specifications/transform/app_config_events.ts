import {getPathValue} from '@shopify/cli-kit/common/object'

/**
 * Transforms the events config from local to remote format.
 * No transformation needed - local config is already in the correct format for the server.
 * The 'identifier' field is server-managed and should not exist in local configs.
 */
export function transformFromEventsConfig(content: object) {
  return content
}

/**
 * Transforms the events config from remote to local format.
 * Strips the server-managed 'identifier' field from subscriptions.
 */
export function transformToEventsConfig(content: object) {
  const eventsConfig = getPathValue(content, 'events') as {api_version: string; subscription: object[]}
  const apiVersion = getPathValue(eventsConfig, 'api_version')
  const subscription = getPathValue(eventsConfig, 'subscription') as {identifier: string}[]

  // Server always includes identifier - strip it for local TOML
  const cleanedSubscriptions = subscription?.map((sub) => {
    const {identifier, ...rest} = sub
    return rest
  })

  const events = apiVersion || cleanedSubscriptions ? {api_version: apiVersion, subscription: cleanedSubscriptions} : {}

  return {events}
}
