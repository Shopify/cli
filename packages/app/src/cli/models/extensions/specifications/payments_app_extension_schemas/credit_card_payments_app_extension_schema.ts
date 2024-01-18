import {BaseSchema} from '../../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

export type CreditCardPaymentsAppExtensionConfigType = zod.infer<typeof CreditCardPaymentsAppExtensionSchema>

const MAX_LABEL_SIZE = 50
const CERTIFICATE_REGEX = /^-----BEGIN CERTIFICATE-----([\s\S]*)-----END CERTIFICATE-----\s?$/

export const CREDIT_CARD_TARGET = 'payments.credit-card.render'
export const CreditCardPaymentsAppExtensionSchema = BaseSchema.extend({
  targeting: zod.array(zod.object({target: zod.literal(CREDIT_CARD_TARGET)})).length(1),
  api_version: zod.string(),
  payment_session_url: zod.string().url(),
  refund_session_url: zod.string().url(),
  capture_session_url: zod.string().url(),
  void_session_url: zod.string().url(),
  verification_session_url: zod.string().url().optional(),
  confirmation_callback_url: zod.string().url().optional(),
  supports_3ds: zod.boolean(),
  supported_countries: zod.array(zod.string()),
  supported_payment_methods: zod.array(zod.string()),
  supports_installments: zod.boolean(),
  supports_deferred_payments: zod.boolean(),
  test_mode_available: zod.boolean(),
  merchant_label: zod.string().max(MAX_LABEL_SIZE),
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
  .refine((schema) => !schema.supports_3ds || schema.confirmation_callback_url, {
    message: 'Property required when supports_3ds is true',
    path: ['confirmation_callback_url'],
  })
  .refine((schema) => schema.supports_installments === schema.supports_deferred_payments, {
    message: 'supports_installments and supports_deferred_payments must be the same',
  })

export async function creditCardPaymentsAppExtensionDeployConfig(
  config: CreditCardPaymentsAppExtensionConfigType,
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
    supported_countries: config.supported_countries,
    supported_payment_methods: config.supported_payment_methods,
    test_mode_available: config.test_mode_available,
    supports_3ds: config.supports_3ds,
    supports_deferred_payments: config.supports_deferred_payments,
    supports_installments: config.supports_installments,
    start_verification_session_url: config.verification_session_url,
    encryption_certificate: config.encryption_certificate,
    checkout_payment_method_fields: config.checkout_payment_method_fields,
  }
}
