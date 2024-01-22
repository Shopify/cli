import {BaseSchema} from '../../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

export type CustomCreditCardPaymentsAppExtensionConfigType = zod.infer<
  typeof CustomCreditCardPaymentsAppExtensionSchema
>

const MAX_LABEL_SIZE = 50

export const CUSTOM_CREDIT_CARD_TARGET = 'payments.custom-credit-card.render'
export const CustomCreditCardPaymentsAppExtensionSchema = BaseSchema.extend({
  targeting: zod.array(zod.object({target: zod.literal(CUSTOM_CREDIT_CARD_TARGET)})).length(1),
  api_version: zod.string(),
  payment_session_url: zod.string().url(),
  refund_session_url: zod.string().url(),
  capture_session_url: zod.string().url(),
  void_session_url: zod.string().url(),
  confirmation_callback_url: zod.string().url().optional(),
  merchant_label: zod.string().max(MAX_LABEL_SIZE),
  supports_3ds: zod.boolean(),
  supported_countries: zod.array(zod.string()),
  supported_payment_methods: zod.array(zod.string()),
  test_mode_available: zod.boolean(),
  multiple_capture: zod.boolean(),
  encryption_certificate: zod.object({}),
  checkout_payment_method_fields: zod.array(zod.object({})).optional(),
  checkout_hosted_fields: zod.array(zod.string()).optional(),
  input: zod
    .object({
      metafield_identifiers: zod
        .object({
          namespace: zod.string(),
          key: zod.string(),
        })
        .optional(),
    })
    .optional(),
})
export async function customCreditCardPaymentsAppExtensionDeployConfig(
  config: CustomCreditCardPaymentsAppExtensionConfigType,
): Promise<{[key: string]: unknown} | undefined> {
  return {
    target: config.targeting[0]!.target,
    api_version: config.api_version,
    start_payment_session_url: config.payment_session_url,
    start_refund_session_url: config.refund_session_url,
    start_capture_session_url: config.capture_session_url,
    start_void_session_url: config.void_session_url,
    confirmation_callback_url: config.confirmation_callback_url,
    merchant_label: config.merchant_label,
    supports_3ds: config.supports_3ds,
    supported_countries: config.supported_countries,
    supported_payment_methods: config.supported_payment_methods,
    encryption_certificate: config.encryption_certificate,
    test_mode_available: config.test_mode_available,
    multiple_capture: config.multiple_capture,
    checkout_payment_method_fields: config.checkout_payment_method_fields,
    checkout_hosted_fields: config.checkout_hosted_fields,
  }
}
