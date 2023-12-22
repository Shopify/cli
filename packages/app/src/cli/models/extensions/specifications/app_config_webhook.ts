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
  const {topics, subscriptions, uri} = webhooks

  if (uri && topics?.length) {
    for (const topic of topics) {
      webhookSubscriptions.push({
        topic,
        uri,
      })
    }
  }

  if (subscriptions?.length) {
    for (const {path, uri: localUri, ...subscription} of subscriptions) {
      // we can assume this is valid from earlier validation, and local URI will overwrite top level if there is any
      const subscriptionConfig = {
        uri: localUri || uri,
        ...subscription,
      }

      if (path) {
        subscriptionConfig.uri = `${subscriptionConfig.uri}${path}`
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
    frequencyMap[item.uri!] = (frequencyMap[item.uri!] || 0) + 1
  })
  const maxCount = Math.max(...Object.values(frequencyMap))
  const defaultUri = Object.keys(frequencyMap).find((key) => frequencyMap[key] === maxCount)

  const topics: string[] = []
  const subscriptions: NormalizedWebhookSubscription[] = []

  for (const item of serverWebhooks) {
    if (item.uri === defaultUri && !item.sub_topic && !item.include_fields && !item.metafield_namespaces) {
      topics.push(item.topic)
    } else {
      let path: string | undefined
      let uri: string | undefined

      // If the URI starts with the defaultUri, extract the rest of the string as the path
      if (item.uri!.startsWith(defaultUri!)) {
        path = item.uri!.slice(defaultUri!.length)
      } else {
        // If the URI does not start with the defaultUri, extract the path using a regular expression
        const pathMatch = item.uri!.match(/^[^:]+:\/\/[^/]+\/(.*)/)
        path = pathMatch ? pathMatch[1] : undefined
        uri = item.uri
      }

      // Exclude undefined keys from the subscription object
      const subscription: NormalizedWebhookSubscription = {...item}
      if (path) subscription.path = path
      if (uri) subscription.uri = uri
      if (item.uri!.startsWith(defaultUri!)) {
        delete subscription.uri
      }
      subscriptions.push(subscription)
    }
  }

  return {webhooks: {uri: defaultUri, topics, subscriptions}}
}

export default spec
