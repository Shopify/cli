import {BasePaymentsAppExtensionSchema, ConfirmationSchema} from './base_payments_app_extension_schema.js'
import {zod} from '@shopify/cli-kit/node/schema'

export type CustomCreditCardPaymentsAppExtensionConfigType = zod.infer<
  typeof CustomCreditCardPaymentsAppExtensionSchema
>

const CERTIFICATE_REGEX = /^-----BEGIN CERTIFICATE-----([\s\S]*)-----END CERTIFICATE-----\s?$|^$/

export const CUSTOM_CREDIT_CARD_TARGET = 'payments.custom-credit-card.render'

export const CustomCreditCardPaymentsAppExtensionSchema = BasePaymentsAppExtensionSchema.merge(ConfirmationSchema)
  .required({
    refund_session_url: true,
    capture_session_url: true,
    void_session_url: true,
  })
  .extend({
    targeting: zod.array(zod.object({target: zod.literal(CUSTOM_CREDIT_CARD_TARGET)})).length(1),
    api_version: zod.string(),
    multiple_capture: zod.boolean(),
    checkout_hosted_fields: zod.array(zod.string()).optional(),
    ui_extension_handle: zod.string().optional(),
    encryption_certificate: zod.object({
      fingerprint: zod.string(),
      certificate: zod.string().regex(CERTIFICATE_REGEX),
    }),
    checkout_payment_method_fields: zod
      .array(
        zod.object({
          type: zod.union([zod.literal('string'), zod.literal('number'), zod.literal('boolean')]),
          required: zod.boolean(),
          key: zod.string(),
        }),
      )
      .optional(),
  })

export async function customCreditCardPaymentsAppExtensionDeployConfig(
  config: CustomCreditCardPaymentsAppExtensionConfigType,
): Promise<{[key: string]: unknown} | undefined> {
  return {
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
    ui_extension_handle: config.ui_extension_handle,
  }
}
