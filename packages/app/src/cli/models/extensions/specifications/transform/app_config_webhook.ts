import {SpecsAppConfiguration} from '../types/app_config.js'
import {WebhooksConfig, NormalizedWebhookSubscription} from '../types/app_config_webhook.js'
import {deepMergeObjects, getPathValue} from '@shopify/cli-kit/common/object'

export function transformWebhookConfig(content: object, fullAppConfig?: object) {
  const webhooks = getPathValue(content, 'webhooks') as WebhooksConfig
  if (!webhooks) return content

  const appConfig = fullAppConfig as SpecsAppConfiguration
  const applicationUrl = appConfig?.application_url

  const webhookSubscriptions = []
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const {api_version, subscriptions = []} = webhooks

  // eslint-disable-next-line no-warning-comments
  // TODO: pass along compliance_topics once we're ready to store them in its own module
  for (const {uri, topics, compliance_topics: _, ...optionalFields} of subscriptions) {
    const uriWithRelativePath = uri.startsWith('/') && applicationUrl ? `${applicationUrl}${uri}` : uri
    webhookSubscriptions.push(topics.map((topic) => ({uri: uriWithRelativePath, topic, ...optionalFields})))
  }

  return webhookSubscriptions.length > 0 ? {subscriptions: webhookSubscriptions.flat(), api_version} : {api_version}
}

export function transformToWebhookConfig(content: object, fullAppConfig?: object) {
  let webhooks = {}
  const apiVersion = getPathValue(content, 'api_version') as string
  webhooks = {...(apiVersion ? {webhooks: {api_version: apiVersion}} : {})}
  const serverWebhooks = getPathValue(content, 'subscriptions') as NormalizedWebhookSubscription[]
  if (!serverWebhooks) return webhooks

  const webhooksSubscriptions: WebhooksConfig['subscriptions'] = []

  const appConfig = fullAppConfig as SpecsAppConfiguration
  const applicationUrl = appConfig?.application_url

  // eslint-disable-next-line @typescript-eslint/naming-convention
  for (const {uri, topic, sub_topic, ...optionalFields} of serverWebhooks) {
    const uriWithRelativePath = uri.includes(applicationUrl) ? uri.replace(applicationUrl, '') : uri

    const currSubscription = webhooksSubscriptions.find(
      (sub) => sub.uri === uriWithRelativePath && sub.sub_topic === sub_topic,
    )
    if (currSubscription) {
      currSubscription.topics.push(topic)
    } else {
      webhooksSubscriptions.push({
        topics: [topic],
        uri: uriWithRelativePath,
        ...(sub_topic ? {sub_topic} : {}),
        ...optionalFields,
      })
    }
  }

  const webhooksSubscriptionsObject = webhooksSubscriptions.length > 0 ? {subscriptions: webhooksSubscriptions} : {}
  return deepMergeObjects(webhooks, {webhooks: webhooksSubscriptionsObject})
}
