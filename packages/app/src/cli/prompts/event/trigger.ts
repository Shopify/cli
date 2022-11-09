import {DELIVERY_METHOD, isAddressAllowedForDeliveryMethod} from '../../services/event/trigger-options.js'
import {ui} from '@shopify/cli-kit'

export async function topicPrompt(): Promise<string> {
  const input = await ui.prompt([
    {
      type: 'input',
      name: 'topic',
      message: 'Webhook Topic',
      default: '',
      validate: (value: string) => {
        if (value.length === 0) {
          return "Topic name can't be empty"
        }
        return true
      },
    },
  ])

  return input.topic
}

export async function apiVersionPrompt(): Promise<string> {
  const input = await ui.prompt([
    {
      type: 'input',
      name: 'apiVersion',
      message: 'Webhook ApiVersion',
      default: '2022-10',
      validate: (value: string) => {
        if (value.length === 0) {
          return "ApiVersion name can't be empty"
        }
        return true
      },
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

export async function addressPrompt(deliveryMethod: string): Promise<string> {
  const input = await ui.prompt([
    {
      type: 'input',
      name: 'address',
      message: 'Address for delivery',
      default: '',
      validate: (value) => {
        if (value.length === 0) {
          return "Address can't be empty"
        }
        if (isAddressAllowedForDeliveryMethod(value, deliveryMethod)) {
          return true
        }

        return `${deliveryMethodInstructions(deliveryMethod)} for ${deliveryMethod}`
      },
    },
  ])

  return input.address
}

export async function sharedSecretPrompt(): Promise<string> {
  const input = await ui.prompt([
    {
      type: 'input',
      name: 'sharedSecret',
      message: 'Shared Secret to endcode the webhook payload',
      default: 'shopify_test',
      validate: (value: string) => {
        if (value.length === 0) {
          return "Shared Secret can't be empty"
        }
        return true
      },
    },
  ])

  return input.sharedSecret
}

export function deliveryMethodInstructions(method: string): string {
  if (method === DELIVERY_METHOD.HTTP) {
    return 'Use either https:// for remote or http://localhost:{port}/{url-path} for local'
  }
  if (method === DELIVERY_METHOD.PUBSUB) {
    return 'Use pubsub://{project-id}:{topic-id}'
  }
  if (method === DELIVERY_METHOD.EVENTBRIDGE) {
    return 'Use an Amazon Resource Name (ARN) starting with arn:aws:events:'
  }

  return ''
}
