import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

export interface WebhookTopicsSchema {
  webhookTopics: string[]
}

const getTopicsQuery = `
  query getWebhookTopics($api_version: String!) {
    webhookTopics(apiVersion: $api_version)
  }
`

/**
 * Requests topics for an api-version in order to validate flags or present a list of options
 *
 * @param token - Partners session token
 * @param apiVersion - ApiVersion of the topics
 * @returns - Available webhook topics for the api-version
 */
export async function requestTopics(token: string, apiVersion: string): Promise<string[]> {
  const variables = {api_version: apiVersion}
  const {webhookTopics: result}: WebhookTopicsSchema = await partnersRequest(getTopicsQuery, token, variables)

  return result
}
