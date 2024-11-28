import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'

export interface WebhookTopicsVariables {
  api_version: string
}

export interface WebhookTopicsSchema {
  webhookTopics: string[]
}

export const getTopicsQuery = `
  query getWebhookTopics($api_version: String!) {
    webhookTopics(apiVersion: $api_version)
  }
`

/**
 * Requests topics for an api-version in order to validate flags or present a list of options
 *
 * @param developerPlatformClient - The client to access the platform API
 * @param apiVersion - ApiVersion of the topics
 * @param organizationId - Organization ID required by the API to verify permissions
 * @returns - Available webhook topics for the api-version
 */
export async function requestTopics(
  developerPlatformClient: DeveloperPlatformClient,
  apiVersion: string,
  organizationId: string,
): Promise<string[]> {
  const variables: WebhookTopicsVariables = {api_version: apiVersion}
  const {webhookTopics: result}: WebhookTopicsSchema = await developerPlatformClient.topics(variables, organizationId)

  return result
}
