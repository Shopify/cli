import {WebhooksConfig} from '../types/app_config_webhook.js'
import {getPathValue} from '@shopify/cli-kit/common/object'

export function transformFromWebhookConfig(content: object) {
  const webhooks = getPathValue(content, 'webhooks') as WebhooksConfig
  if (!webhooks) return content

  return {api_version: webhooks.api_version}
}

export function transformToWebhookConfig(content: object) {
  const apiVersion = getPathValue(content, 'api_version') as string
  return {...(apiVersion ? {webhooks: {api_version: apiVersion}} : {})}
}
