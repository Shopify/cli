import {DELIVERY_METHOD, isAddressAllowedForDeliveryMethod} from '../../services/webhook/trigger-options.js'
import {ui} from '@shopify/cli-kit'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'
import {stringifyMessage} from '@shopify/cli-kit/node/output'

export async function topicPrompt(availableTopics: string[]): Promise<string> {
  const choicesList = availableTopics.map((topic) => ({label: topic, value: topic}))

  const chosen = await renderAutocompletePrompt({
    message: 'Webhook Topic',
    choices: choicesList,
  })

  return chosen
}

export async function apiVersionPrompt(availableVersions: string[]): Promise<string> {
  const choices = availableVersions.map((version) => ({name: version, value: version}))

  const input = await ui.prompt([
    {
      type: 'select',
      name: 'apiVersion',
      message: 'Webhook ApiVersion',
      choices,
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
        const trimmed = value.trim()
        if (trimmed.length === 0) {
          return "Address can't be empty"
        }
        if (isAddressAllowedForDeliveryMethod(trimmed, deliveryMethod)) {
          return true
        }

        return `Invalid address.\n${deliveryMethodInstructionsAsString(deliveryMethod)}`
      },
    },
  ])

  return input.address.trim()
}

export async function sharedSecretPrompt(): Promise<string> {
  const input = await ui.prompt([
    {
      type: 'input',
      name: 'sharedSecret',
      message:
        'Shared Secret to encode the webhook payload. If you are using the app template, this is your Client Secret, which can be found in the partners dashboard',
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

export function deliveryMethodInstructions(method: string): string[] {
  if (method === DELIVERY_METHOD.HTTP) {
    return [
      `For remote HTTP testing, use a URL that starts with https://`,
      `For local HTTP testing, use http://localhost:{port}/{url-path}`,
    ]
  }
  if (method === DELIVERY_METHOD.PUBSUB) {
    return [`For Google Pub/Sub, use pubsub://{project-id}:{topic-id}`]
  }
  if (method === DELIVERY_METHOD.EVENTBRIDGE) {
    return [`For Amazon EventBridge, use an Amazon Resource Name (ARN) starting with arn:aws:events:`]
  }

  return []
}

export function deliveryMethodInstructionsAsString(method: string): string {
  return deliveryMethodInstructions(method)
    .map((hint) => `      · ${stringifyMessage(hint)}`)
    .join('\n')
}
