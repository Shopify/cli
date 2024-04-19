import {
  BasePaymentsAppExtensionSchema,
  BasePaymentsAppExtensionDeployConfigType,
  BuyerLabelSchema,
  ConfirmationSchema,
  DeferredPaymentsSchema,
  MultipleCaptureSchema,
} from './base_payments_app_extension_schema.js'
import {zod} from '@shopify/cli-kit/node/schema'

export type OffsitePaymentsAppExtensionConfigType = zod.infer<typeof OffsitePaymentsAppExtensionSchema>

export const OFFSITE_TARGET = 'payments.offsite.render'

export const OffsitePaymentsAppExtensionSchema = BasePaymentsAppExtensionSchema.merge(BuyerLabelSchema)
  .merge(DeferredPaymentsSchema)
  .merge(ConfirmationSchema)
  .merge(MultipleCaptureSchema)
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

export interface OffsitePaymentsAppExtensionDeployConfigType extends BasePaymentsAppExtensionDeployConfigType {
  // MultipleCaptureSchema
  multiple_capture?: boolean

  // BuyerLabelSchema
  default_buyer_label?: string
  buyer_label_to_locale?: {locale: string; label: string}[]

  // DeferredPaymentsSchema
  supports_deferred_payments: boolean
  supports_installments: boolean

  // ConfirmationSchema
  confirmation_callback_url?: string
  supports_3ds: boolean
}

export function offsiteDeployConfigToCLIConfig(
  config: OffsitePaymentsAppExtensionDeployConfigType,
): Omit<OffsitePaymentsAppExtensionConfigType, 'name' | 'type' | 'metafields' | 'targeting'> | undefined {
  return {
    api_version: config.api_version,
    payment_session_url: config.start_payment_session_url,
    refund_session_url: config.start_refund_session_url,
    capture_session_url: config.start_capture_session_url,
    void_session_url: config.start_void_session_url,
    confirmation_callback_url: config.confirmation_callback_url,
    multiple_capture: config.multiple_capture,
    merchant_label: config.merchant_label,
    supported_countries: config.supported_countries,
    supported_payment_methods: config.supported_payment_methods,
    test_mode_available: config.test_mode_available,
    buyer_label: config.default_buyer_label,
    buyer_label_translations: config.buyer_label_to_locale,
    supports_oversell_protection: config.supports_oversell_protection,
    supports_3ds: config.supports_3ds,
    supports_deferred_payments: config.supports_deferred_payments,
    supports_installments: config.supports_installments,
  }
}

export async function offsitePaymentsAppExtensionDeployConfig(
  config: OffsitePaymentsAppExtensionConfigType,
): Promise<{[key: string]: unknown} | undefined> {
  return {
    api_version: config.api_version,
    start_payment_session_url: config.payment_session_url,
    start_refund_session_url: config.refund_session_url,
    start_capture_session_url: config.capture_session_url,
    start_void_session_url: config.void_session_url,
    confirmation_callback_url: config.confirmation_callback_url,
    multiple_capture: config.multiple_capture,
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
