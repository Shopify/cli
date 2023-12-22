import {CustomTransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {AppSchema, NormalizedWebhookSubscription, WebhookConfig} from '../../app/app.js'
import {getPathValue} from '@shopify/cli-kit/common/object'

export const WebhookSchema = AppSchema.pick({webhooks: true}).strip()

const WebhookTransformConfig: CustomTransformationConfig = {
  forward: (content: object) => transformWebhookConfig(content),
  reverse: (content: object) => transformToWebhookConfig(content),
}

const spec = createConfigExtensionSpecification({
  identifier: 'webhooks',
  schema: WebhookSchema,
  transformConfig: WebhookTransformConfig,
})

// Transform methods
export function transformWebhookConfig(content: object) {
  const webhooks = getPathValue(content, 'webhooks') as WebhookConfig

  // normalize webhook config with the top level config
  const webhookSubscriptions = []
  const {topics, subscriptions, endpoint} = webhooks

  if (endpoint && topics?.length) {
    for (const topic of topics) {
      webhookSubscriptions.push({
        topic,
        endpoint,
      })
    }
  }

  if (subscriptions?.length) {
    for (const {path, endpoint: localEndpoint, ...subscription} of subscriptions) {
      // we can assume this is valid from earlier validation, and local endpoint will overwrite top level if there is any
      const subscriptionConfig = {
        endpoint: localEndpoint || endpoint,
        ...subscription,
      }

      if (path) {
        subscriptionConfig.endpoint = `${subscriptionConfig.endpoint}${path}`
      }

      webhookSubscriptions.push(subscriptionConfig)
    }
  }
  return webhookSubscriptions.length > 0 ? {subscriptions: webhookSubscriptions} : {}
}

export function transformToWebhookConfig(content: object) {
  const serverWebhooks = getPathValue(content, 'subscriptions') as NormalizedWebhookSubscription[]
  const frequencyMap: {[key: string]: number} = {}
  serverWebhooks.forEach((item) => {
    frequencyMap[item.endpoint!] = (frequencyMap[item.endpoint!] || 0) + 1
  })
  const maxCount = Math.max(...Object.values(frequencyMap))
  const defaultEndpoint = Object.keys(frequencyMap).find((key) => frequencyMap[key] === maxCount)

  const topics: string[] = []
  const subscriptions: NormalizedWebhookSubscription[] = []

  for (const item of serverWebhooks) {
    if (item.endpoint === defaultEndpoint && !item.sub_topic && !item.include_fields && !item.metafield_namespaces) {
      topics.push(item.topic)
    } else {
      let path: string | undefined
      let endpoint: string | undefined

      // If the endpoint starts with the defaultEndpoint, extract the rest of the string as the path
      if (item.endpoint!.startsWith(defaultEndpoint!)) {
        path = item.endpoint!.slice(defaultEndpoint!.length)
      } else {
        // If the endpoint does not start with the defaultEndpoint, extract the path using a regular expression
        const pathMatch = item.endpoint!.match(/^[^:]+:\/\/[^/]+\/(.*)/)
        path = pathMatch ? pathMatch[1] : undefined
        endpoint = item.endpoint
      }

      // Exclude undefined keys from the subscription object
      const subscription: NormalizedWebhookSubscription = {...item}
      if (path) subscription.path = path
      if (endpoint) subscription.endpoint = endpoint
      if (item.endpoint!.startsWith(defaultEndpoint!)) {
        delete subscription.endpoint
      }
      subscriptions.push(subscription)
    }
  }

  return {webhooks: {endpoint: defaultEndpoint, topics, subscriptions}}
}

export default spec
