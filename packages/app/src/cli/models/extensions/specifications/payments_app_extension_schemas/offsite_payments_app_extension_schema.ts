import {
  BasePaymentsAppExtensionSchema,
  BuyerLabelSchema,
  ConfirmationSchema,
  DeferredPaymentsSchema,
} from './base_payments_app_extension_schema.js'
import {zod} from '@shopify/cli-kit/node/schema'

export type OffsitePaymentsAppExtensionConfigType = zod.infer<typeof OffsitePaymentsAppExtensionSchema>

export const OFFSITE_TARGET = 'payments.offsite.render'

export const OffsitePaymentsAppExtensionSchema = BasePaymentsAppExtensionSchema.merge(BuyerLabelSchema)
  .merge(DeferredPaymentsSchema)
  .merge(ConfirmationSchema)
  .extend({
    targeting: zod.array(zod.object({target: zod.literal(OFFSITE_TARGET)})).length(1),
    supports_oversell_protection: zod.boolean().optional(),
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
