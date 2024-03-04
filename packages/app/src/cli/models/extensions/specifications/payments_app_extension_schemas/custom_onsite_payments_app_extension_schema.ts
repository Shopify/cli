import {
  BasePaymentsAppExtensionSchema,
  BuyerLabelSchema,
  ConfirmationSchema,
  DeferredPaymentsSchema,
} from './base_payments_app_extension_schema.js'
import {zod} from '@shopify/cli-kit/node/schema'

export type CustomOnsitePaymentsAppExtensionConfigType = zod.infer<typeof CustomOnsitePaymentsAppExtensionSchema>

export const CUSTOM_ONSITE_TARGET = 'payments.custom-onsite.render'

export const CustomOnsitePaymentsAppExtensionSchema = BasePaymentsAppExtensionSchema.merge(BuyerLabelSchema)
  .merge(DeferredPaymentsSchema)
  .merge(ConfirmationSchema)
  .extend({
    targeting: zod.array(zod.object({target: zod.literal(CUSTOM_ONSITE_TARGET)})).length(1),
    update_payment_session_url: zod.string().url().optional(),
    multiple_capture: zod.boolean().optional(),
    supports_oversell_protection: zod.boolean().optional(),
    modal_payment_method_fields: zod.array(zod.object({})).optional(),
    ui_extension_handle: zod.string().optional(),
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
  .refine((schema) => schema.supports_installments === schema.supports_deferred_payments, {
    message: 'supports_installments and supports_deferred_payments must be the same',
  })

export async function customOnsitePaymentsAppExtensionDeployConfig(
  config: CustomOnsitePaymentsAppExtensionConfigType,
): Promise<{[key: string]: unknown} | undefined> {
  return {
    api_version: config.api_version,
    start_payment_session_url: config.payment_session_url,
    start_refund_session_url: config.refund_session_url,
    start_capture_session_url: config.capture_session_url,
    start_void_session_url: config.void_session_url,
    confirmation_callback_url: config.confirmation_callback_url,
    update_payment_session_url: config.update_payment_session_url,
    merchant_label: config.merchant_label,
    supports_oversell_protection: config.supports_oversell_protection,
    supports_3ds: config.supports_3ds,
    supports_installments: config.supports_installments,
    supports_deferred_payments: config.supports_deferred_payments,
    supported_countries: config.supported_countries,
    supported_payment_methods: config.supported_payment_methods,
    test_mode_available: config.test_mode_available,
    multiple_capture: config.multiple_capture,
    default_buyer_label: config.buyer_label,
    buyer_label_to_locale: config.buyer_label_translations,
    checkout_payment_method_fields: config.checkout_payment_method_fields,
    modal_payment_method_fields: config.modal_payment_method_fields,
    ui_extension_handle: config.ui_extension_handle,
  }
}
