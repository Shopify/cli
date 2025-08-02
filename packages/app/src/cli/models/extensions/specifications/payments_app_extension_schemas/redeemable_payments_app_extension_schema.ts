import {
  BasePaymentsAppExtensionSchema,
  BasePaymentsAppExtensionDeployConfigType,
  BuyerLabelSchema,
  SupportedBuyerContextsSchema,
} from './base_payments_app_extension_schema.js'
import {ExtensionRegistration} from '../../../../api/graphql/all_app_extension_registrations.js'
import {extensionUuidToHandle} from '../transform/extension_uuid_to_handle.js'
import {zod} from '@shopify/cli-kit/node/schema'

export type RedeemablePaymentsAppExtensionConfigType = zod.infer<typeof RedeemablePaymentsAppExtensionSchema>

export const REDEEMABLE_TARGET = 'payments.redeemable.render'

export const RedeemablePaymentsAppExtensionSchema = BasePaymentsAppExtensionSchema.merge(BuyerLabelSchema)
  .merge(SupportedBuyerContextsSchema)
  .extend({
    targeting: zod.array(zod.object({target: zod.literal(REDEEMABLE_TARGET)})).length(1),
    api_version: zod.string(),
    balance_url: zod.string().url(),
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
      .optional(),
  })

export interface RedeemablePaymentsAppExtensionDeployConfigType extends BasePaymentsAppExtensionDeployConfigType {
  // BuyerLabelSchema
  default_buyer_label?: string
  buyer_label_to_locale?: {locale: string; label: string}[]

  // Redeemable-specific fields
  balance_url: string
  redeemable_type: string
  ui_extension_registration_uuid?: string
  ui_extension_handle?: string
  checkout_payment_method_fields?: {
    type: 'string' | 'number' | 'boolean'
    required: boolean
    key: string
  }[]
}

export function redeemableDeployConfigToCLIConfig(
  config: RedeemablePaymentsAppExtensionDeployConfigType,
  allExtensions: ExtensionRegistration[],
): Omit<RedeemablePaymentsAppExtensionConfigType, 'name' | 'type' | 'metafields' | 'targeting'> | undefined {
  const uiExtensionHandle = extensionUuidToHandle(config, allExtensions)

  return {
    api_version: config.api_version,
    payment_session_url: config.start_payment_session_url,
    refund_session_url: config.start_refund_session_url,
    capture_session_url: config.start_capture_session_url,
    void_session_url: config.start_void_session_url,
    merchant_label: config.merchant_label,
    supported_countries: config.supported_countries,
    supported_payment_methods: config.supported_payment_methods,
    supported_buyer_contexts: config.supported_buyer_contexts,
    test_mode_available: config.test_mode_available,
    buyer_label: config.default_buyer_label,
    buyer_label_translations: config.buyer_label_to_locale,
    balance_url: config.balance_url,
    checkout_payment_method_fields: config.checkout_payment_method_fields?.map((field) => ({
      key: field.key,
      type: field.type,
      required: field.required,
    })),
    ui_extension_handle: uiExtensionHandle,
  }
}

export async function redeemablePaymentsAppExtensionDeployConfig(
  config: RedeemablePaymentsAppExtensionConfigType,
): Promise<{[key: string]: unknown} | undefined> {
  const redeemableType = config.supported_payment_methods[0] === 'gift-card' ? 'gift_card' : null
  
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
    merchant_label: config.merchant_label,
    supported_countries: config.supported_countries,
    supported_payment_methods: config.supported_payment_methods,
    supported_buyer_contexts: config.supported_buyer_contexts,
    test_mode_available: config.test_mode_available,
    default_buyer_label: config.buyer_label,
    buyer_label_to_locale: config.buyer_label_translations,
    balance_url: config.balance_url,
    redeemable_type: redeemableType,
    checkout_payment_method_fields: config.checkout_payment_method_fields,
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
