import {
  addressPrompt,
  apiVersionPrompt,
  deliveryMethodInstructions,
  deliveryMethodPrompt,
  sharedSecretPrompt,
  topicPrompt,
} from './trigger.js'
import {
  DELIVERY_METHOD,
  EventTriggerOptions,
  deliveryMethodForAddress,
  isAddressAllowedForDeliveryMethod,
} from '../../services/event/trigger-options.js'
import {error} from '@shopify/cli-kit'

/**
 * Flags collected from the command line parameters
 */
export interface EventTriggerFlags {
  topic?: string
  apiVersion?: string
  deliveryMethod?: string
  address?: string
  sharedSecret?: string
}

/**
 * Collect all required data, validate and transform values into options for the Service
 * Some UX decisions:
 * - Flags validation will happen before we request any prompts
 * - Any option not passed as a flag will be requested via prompt
 * - In the case of having a flag for address and not for delivery-method, the delivery-method will be inferred from it
 * - An http delivery method sent to a localhost address will be transformed into a localhost delivery method.
 *   `localhost` is only internal: it requests core to return the data so that the plugin will deliver it locally without
 *   needing ngrok
 *
 * @param flags - Flags collected from the command-line arguments
 * @returns flags/prompts transformed into EventTriggerOptions to pass to the service
 */
export async function optionsPrompt(flags: EventTriggerFlags): Promise<EventTriggerOptions> {
  const options: EventTriggerOptions = {
    topic: '',
    apiVersion: '',
    sharedSecret: '',
    deliveryMethod: '',
    address: '',
  }

  const methodPassed = flagPassed(flags.deliveryMethod)
  const addressPassed = flagPassed(flags.address)

  if (methodPassed && !validDeliveryMethodFlag(flags.deliveryMethod)) {
    throw new error.Abort(
      'Invalid delivery-method passed',
      `${DELIVERY_METHOD.HTTP}, ${DELIVERY_METHOD.PUBSUB}, and ${DELIVERY_METHOD.EVENTBRIDGE} are allowed`,
    )
  }

  if (methodPassed && addressPassed) {
    if (isAddressAllowedForDeliveryMethod(flags.address as string, flags.deliveryMethod as string)) {
      options.address = flags.address as string
      options.deliveryMethod = inferMethodFromAddress(options.address)
    } else {
      throw new error.Abort(
        'Invalid address for delivery method',
        `${deliveryMethodInstructions(flags.deliveryMethod as string)} for ${flags.deliveryMethod}`,
      )
    }
  }

  if (!methodPassed && addressPassed) {
    options.address = flags.address as string
    options.deliveryMethod = inferMethodFromAddress(options.address)
  }

  options.topic = await useFlagOrPrompt(flags.topic, topicPrompt)
  options.apiVersion = await useFlagOrPrompt(flags.apiVersion, apiVersionPrompt)
  options.sharedSecret = await useFlagOrPrompt(flags.sharedSecret, sharedSecretPrompt)

  if (!methodPassed && !addressPassed) {
    const method = await deliveryMethodPrompt()
    options.address = await addressPrompt(method)
    options.deliveryMethod = inferMethodFromAddress(options.address)
  }

  if (methodPassed && !addressPassed) {
    options.address = await addressPrompt(flags.deliveryMethod as string)
    options.deliveryMethod = inferMethodFromAddress(options.address)
  }

  return options
}

async function useFlagOrPrompt(value: string | undefined, prompt: () => Promise<string>): Promise<string> {
  return flagPassed(value) ? (value as string) : prompt()
}

function flagPassed(flag: string | undefined) {
  if (flag === undefined) {
    return false
  }

  return flag.length > 0
}

function validDeliveryMethodFlag(value: string | undefined): boolean {
  return value === DELIVERY_METHOD.HTTP || value === DELIVERY_METHOD.PUBSUB || value === DELIVERY_METHOD.EVENTBRIDGE
}

function inferMethodFromAddress(address: string): string {
  const method = deliveryMethodForAddress(address)

  if (method === undefined) {
    throw new error.Abort(
      'No delivery method available for the address',
      `Use a valid address for ${DELIVERY_METHOD.HTTP}, ${DELIVERY_METHOD.PUBSUB} or ${DELIVERY_METHOD.EVENTBRIDGE}`,
    )
  }

  return method
}
