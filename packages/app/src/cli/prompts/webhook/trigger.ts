import {DELIVERY_METHOD, isAddressAllowedForDeliveryMethod} from '../../services/webhook/trigger-flags.js'
import {renderAutocompletePrompt, renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'
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
  return renderSelectPrompt({
    message: 'Webhook ApiVersion',
    choices: availableVersions.map((version) => ({label: version, value: version})),
  })
}

export async function deliveryMethodPrompt(): Promise<string> {
  return renderSelectPrompt({
    message: 'Delivery method',
    choices: [
      {label: 'HTTP', value: DELIVERY_METHOD.HTTP},
      {label: 'Google Pub/Sub', value: DELIVERY_METHOD.PUBSUB},
      {label: 'Amazon EventBridge', value: DELIVERY_METHOD.EVENTBRIDGE},
    ],
  })
}

export async function addressPrompt(deliveryMethod: string): Promise<string> {
  const input = await renderTextPrompt({
    message: 'Address for delivery',
    validate: (value) => {
      const trimmed = value.trim()
      if (trimmed.length === 0) {
        return "Address can't be empty"
      }
      if (!isAddressAllowedForDeliveryMethod(trimmed, deliveryMethod)) {
        return `Invalid address.\n${deliveryMethodInstructionsAsString(deliveryMethod)}`
      }
    },
  })

  return input.trim()
}

export async function clientSecretPrompt(): Promise<string> {
  return renderTextPrompt({
    message:
      'Client Secret to encode the webhook payload. If you are using the app template, this can be found in the partners dashboard',
    defaultValue: 'shopify_test',
    validate: (value: string) => {
      if (value.length === 0) {
        return "Client Secret can't be empty"
      }
    },
  })
}

function deliveryMethodInstructions(method: string): string[] {
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
