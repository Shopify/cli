import {BaseSchema} from '../../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

export type OffsitePaymentsAppExtensionConfigType = zod.infer<typeof OffsitePaymentsAppExtensionSchema>

const MAX_LABEL_SIZE = 50
export const OFFSITE_TARGET = 'payments.offsite.render'
export const OffsitePaymentsAppExtensionSchema = BaseSchema.extend({
  targeting: zod.array(zod.object({target: zod.literal(OFFSITE_TARGET)})).length(1),
  api_version: zod.string(),
  payment_session_url: zod.string().url(),
  refund_session_url: zod.string().url().optional(),
  capture_session_url: zod.string().url().optional(),
  void_session_url: zod.string().url().optional(),
  confirmation_callback_url: zod.string().url().optional(),
  merchant_label: zod.string().max(MAX_LABEL_SIZE),
  buyer_label: zod.string().max(MAX_LABEL_SIZE).optional(),
  buyer_label_translations: zod.array(zod.object({locale: zod.string(), label: zod.string()})).optional(),
  supports_oversell_protection: zod.boolean().optional(),
  supports_3ds: zod.boolean(),
  supports_installments: zod.boolean(),
  supports_deferred_payments: zod.boolean(),
  supported_countries: zod.array(zod.string()),
  supported_payment_methods: zod.array(zod.string()),
  test_mode_available: zod.boolean(),
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
  .refine((schema) => !schema.supports_oversell_protection || schema.confirmation_callback_url, {
    message: 'Property required when supports_oversell_protection is true',
    path: ['confirmation_callback_url'],
  })
  .refine((schema) => schema.supports_installments === schema.supports_deferred_payments, {
    message: 'supports_installments and supports_deferred_payments must be the same',
  })

export async function offsitePaymentsAppExtensionDeployConfig(
  config: OffsitePaymentsAppExtensionConfigType,
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
    default_buyer_label: config.buyer_label,
    buyer_label_to_locale: config.buyer_label_translations,
    supports_oversell_protection: config.supports_oversell_protection,
    supports_3ds: config.supports_3ds,
    supports_deferred_payments: config.supports_deferred_payments,
    supports_installments: config.supports_installments,
  }
}
