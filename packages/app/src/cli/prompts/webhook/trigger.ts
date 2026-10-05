import {
  DELIVERY_METHOD,
  deliveryMethodInstructions,
  isAddressAllowedForDeliveryMethod,
} from '../../services/webhook/trigger-flags.js'
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

export function deliveryMethodInstructionsAsString(method: string): string {
  return deliveryMethodInstructions(method)
    .map((hint) => `      · ${stringifyMessage(hint)}`)
    .join('\n')
}
