import { CustomTransformationConfig, createConfigExtensionSpecification } from "../specification.js"
import { WebhookSchema, WebhookSimplifyConfig } from "./app_config_webhook.js"
import {Flag} from '../../../services/dev/fetch.js'
import {compact, deepMergeObjects, getPathValue} from '@shopify/cli-kit/common/object'
import { NormalizedWebhookSubscription, WebhooksConfig } from "./types/app_config_webhook.js"

export const WebhookSubscriptionsSpecIdentifier = 'webhooks_subscriptions'

export function transformFromWebhookConfig(content: object) {
  const webhooks = getPathValue(content, 'webhooks') as WebhooksConfig
  if (!webhooks) return content

  const webhookSubscriptions = []
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const {api_version, subscriptions = []} = webhooks

  // Compliance topics are handled from app_config_privacy_compliance_webhooks.ts
  for (const {uri, topics, compliance_topics: _, ...optionalFields} of subscriptions) {
    if (topics) webhookSubscriptions.push(topics.map((topic) => ({uri, topic, ...optionalFields})))
  }

  return webhookSubscriptions.length > 0 ? {subscriptions: webhookSubscriptions.flat(), api_version} : {api_version}
}

export function transformToWebhookConfig(content: object) {
  let webhooks = {}
  const apiVersion = getPathValue(content, 'api_version') as string
  webhooks = {...(apiVersion ? {webhooks: {api_version: apiVersion}} : {})}
  const serverWebhooks = getPathValue(content, 'subscriptions') as NormalizedWebhookSubscription[]
  if (!serverWebhooks) return webhooks

  const webhooksSubscriptions: WebhooksConfig['subscriptions'] = []

  for (const {topic, ...otherFields} of serverWebhooks) {
    webhooksSubscriptions.push({topics: [topic], ...otherFields})
  }

  const webhooksSubscriptionsObject = webhooksSubscriptions.length > 0 ? {subscriptions: webhooksSubscriptions} : {}
  return deepMergeObjects(webhooks, {webhooks: webhooksSubscriptionsObject})
}

const WebhooksSubscriptionsTransformConfig: CustomTransformationConfig = {
  forward: (content: object) => transformFromWebhookConfig(content),
  reverse: (content: object) => transformToWebhookConfig(content),
}

// Uses the same schema as the webhooks specs because its content is nested under the same webhooks section
const webhookSubscriptionsSpec = createConfigExtensionSpecification({
  identifier: WebhookSubscriptionsSpecIdentifier,
  schema: WebhookSchema,
  transformConfig: WebhooksSubscriptionsTransformConfig,
  simplify: WebhookSimplifyConfig,
})

export default webhookSubscriptionsSpec
