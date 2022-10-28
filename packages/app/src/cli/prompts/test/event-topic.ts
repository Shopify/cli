import {DELIVERY_METHOD} from '../../services/app/test/event-topic.js'
import {ui} from '@shopify/cli-kit'

export async function topicPrompt(defaultValue?: string): Promise<string> {
  const input = await ui.prompt([
    {
      type: 'input',
      name: 'topic',
      message: 'Webhook Topic Name',
      default: defaultValue === undefined ? '' : defaultValue,
      validate: (value) => {
        if (value.length === 0) {
          return "Topic name can't be empty"
        }
        return true
      },
    },
  ])

  return input.topic
}

export async function apiVersionPrompt(defaultValue?: string): Promise<string> {
  const input = await ui.prompt([
    {
      type: 'input',
      name: 'apiVersion',
      message: 'Webhook ApiVersion',
      default: defaultValue === undefined ? '2022-07' : defaultValue,
    },
  ])

  return input.apiVersion
}

export async function deliveryMethodPrompt(): Promise<string> {
  const choices = [
    {name: 'HTTP', value: DELIVERY_METHOD.HTTP},
    {name: 'Google Pub/Sub', value: DELIVERY_METHOD.PUBSUB},
    {name: 'Amazon EventBridge', value: DELIVERY_METHOD.EVENTBRIDGE},
  ]

  const input = await ui.prompt([
    {
      type: 'select',
      name: 'value',
      message: 'Delivery method',
      choices,
    },
  ])

  return input.value
}

export async function localPortPrompt(defaultValue?: string): Promise<string> {
  const input = await ui.prompt([
    {
      type: 'input',
      name: 'port',
      message: 'Port for localhost delivery',
      default: defaultValue === undefined ? '' : defaultValue,
      validate: (value) => {
        if (value.length === 0) {
          return "Port can't be empty"
        }
        return true
      },
    },
  ])

  return input.port
}

export async function localUrlPathPrompt(defaultValue?: string): Promise<string> {
  const input = await ui.prompt([
    {
      type: 'input',
      name: 'urlPath',
      message: 'URL path for localhost delivery',
      default: defaultValue === undefined ? '/api/webhooks' : defaultValue,
    },
  ])

  if (input.urlPath.length > 0 && !input.urlPath.startsWith('/')) {
    input.urlPath = `/${input.urlPath}`
  }

  return input.urlPath
}

export async function addressPrompt(defaultValue?: string): Promise<string> {
  const input = await ui.prompt([
    {
      type: 'input',
      name: 'address',
      message: 'Address for delivery',
      default: defaultValue === undefined ? '' : defaultValue,
      validate: (value) => {
        if (value.length === 0) {
          return "Address can't be empty"
        }
        return true
      },
    },
  ])

  return input.address
}

export async function sharedSecretPrompt(defaultValue?: string): Promise<string> {
  const input = await ui.prompt([
    {
      type: 'input',
      name: 'sharedSecret',
      message: 'Shared Secret to endcode the webhook payload',
      default: defaultValue === undefined ? 'shopify_test' : defaultValue,
    },
  ])

  return input.sharedSecret
}
