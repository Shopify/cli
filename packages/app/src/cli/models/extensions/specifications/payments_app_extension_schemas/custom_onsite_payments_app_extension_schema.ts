import {
  BasePaymentsAppExtensionSchema,
  BasePaymentsAppExtensionDeployConfigType,
  BuyerLabelSchema,
  ConfirmationSchema,
  DeferredPaymentsSchema,
  SupportedBuyerContextsSchema,
} from './base_payments_app_extension_schema.js'
import {ExtensionRegistration} from '../../../../api/graphql/all_app_extension_registrations.js'
import {extensionUuidToHandle} from '../transform/extension_uuid_to_handle.js'
import {zod} from '@shopify/cli-kit/node/schema'

export type CustomOnsitePaymentsAppExtensionConfigType = zod.infer<typeof CustomOnsitePaymentsAppExtensionSchema>

export const CUSTOM_ONSITE_TARGET = 'payments.custom-onsite.render'
export const MAX_CHECKOUT_PAYMENT_METHOD_FIELDS = 7

export const CustomOnsitePaymentsAppExtensionSchema = BasePaymentsAppExtensionSchema.merge(BuyerLabelSchema)
  .merge(DeferredPaymentsSchema)
  .merge(ConfirmationSchema)
  .merge(SupportedBuyerContextsSchema)
  .extend({
    targeting: zod.array(zod.object({target: zod.literal(CUSTOM_ONSITE_TARGET)})).length(1),
    update_payment_session_url: zod.string().url().optional(),
    multiple_capture: zod.boolean().optional(),
    supports_oversell_protection: zod.boolean().optional(),
    modal_payment_method_fields: zod.array(zod.object({})).optional(),
    ui_extension_handle: zod.string().optional(),
    ui: zod
      .union([
        // Legacy single UI object format
        zod.object({
          handle: zod.string().optional(),
        }),
        // New array format
        zod.array(
          zod.object({
            handle: zod.string().optional(),
          })
        )
      ])
      .optional(),
    checkout_payment_method_fields: zod
      .array(
        zod.object({
          type: zod.union([zod.literal('string'), zod.literal('number'), zod.literal('boolean')]),
          required: zod.boolean(),
          key: zod.string(),
        }),
      )
      .max(
        MAX_CHECKOUT_PAYMENT_METHOD_FIELDS,
        `The extension can't have more than ${MAX_CHECKOUT_PAYMENT_METHOD_FIELDS} checkout_payment_method_fields`,
      )
      .optional(),
  })
  .refine((schema) => schema.supports_installments === schema.supports_deferred_payments, {
    message: 'supports_installments and supports_deferred_payments must be the same',
  })

export interface CustomOnsitePaymentsAppExtensionDeployConfigType extends BasePaymentsAppExtensionDeployConfigType {
  // BuyerLabelSchema
  default_buyer_label?: string
  buyer_label_to_locale?: {locale: string; label: string}[]

  // DeferredPaymentsSchema
  supports_deferred_payments: boolean
  supports_installments: boolean

  // ConfirmationSchema
  confirmation_callback_url?: string
  supports_3ds: boolean

  // CustomOnsite-specific fields
  update_payment_session_url?: string
  multiple_capture?: boolean
  supports_oversell_protection?: boolean
  modal_payment_method_fields?: {[key: string]: unknown}[]
  ui_extension_registration_uuid?: string
  ui_extension_handle?: string
  checkout_payment_method_fields?: {
    type: 'string' | 'number' | 'boolean'
    required: boolean
    key: string
  }[]
}

export function customOnsiteDeployConfigToCLIConfig(
  config: CustomOnsitePaymentsAppExtensionDeployConfigType,
  allExtensions: ExtensionRegistration[],
): Omit<CustomOnsitePaymentsAppExtensionConfigType, 'name' | 'type' | 'metafields' | 'targeting'> | undefined {
  const uiExtensionHandle = extensionUuidToHandle(config, allExtensions)

  return {
    api_version: config.api_version,
    payment_session_url: config.start_payment_session_url,
    refund_session_url: config.start_refund_session_url,
    capture_session_url: config.start_capture_session_url,
    void_session_url: config.start_void_session_url,
    confirmation_callback_url: config.confirmation_callback_url,
    update_payment_session_url: config.update_payment_session_url,
    merchant_label: config.merchant_label,
    supports_oversell_protection: config.supports_oversell_protection,
    supports_3ds: config.supports_3ds,
    supports_installments: config.supports_installments,
    supports_deferred_payments: config.supports_deferred_payments,
    supported_countries: config.supported_countries,
    supported_payment_methods: config.supported_payment_methods,
    supported_buyer_contexts: config.supported_buyer_contexts,
    test_mode_available: config.test_mode_available,
    multiple_capture: config.multiple_capture,
    buyer_label: config.default_buyer_label,
    buyer_label_translations: config.buyer_label_to_locale,
    checkout_payment_method_fields: config.checkout_payment_method_fields,
    modal_payment_method_fields: config.modal_payment_method_fields,
    ui_extension_handle: uiExtensionHandle,
  }
}

export async function customOnsitePaymentsAppExtensionDeployConfig(
  config: CustomOnsitePaymentsAppExtensionConfigType,
): Promise<{[key: string]: unknown} | undefined> {
  // Handle UI extensions from both legacy ui_extension_handle and new ui array format
  let uiExtensionHandle = config.ui_extension_handle
  let useNestedUIFormat = false
  
  if (config.ui && !uiExtensionHandle) {
    useNestedUIFormat = true
    if (Array.isArray(config.ui)) {
      // New array format - get handle from first UI extension
      uiExtensionHandle = config.ui[0]?.handle
    } else {
      // Legacy single UI object format
      uiExtensionHandle = config.ui.handle
    }
  }

  const baseConfig = {
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
    supported_buyer_contexts: config.supported_buyer_contexts,
    test_mode_available: config.test_mode_available,
    multiple_capture: config.multiple_capture,
    default_buyer_label: config.buyer_label,
    buyer_label_to_locale: config.buyer_label_translations,
    checkout_payment_method_fields: config.checkout_payment_method_fields,
    modal_payment_method_fields: config.modal_payment_method_fields,
  }

  // When using [[extensions.ui]], return nested format like functions
  if (useNestedUIFormat && uiExtensionHandle) {
    return {
      ...baseConfig,
      ui: {
        ui_extension_handle: uiExtensionHandle,
      },
    }
  }

  // For legacy ui_extension_handle, keep top-level format
  return {
    ...baseConfig,
    ui_extension_handle: uiExtensionHandle,
  }
}
