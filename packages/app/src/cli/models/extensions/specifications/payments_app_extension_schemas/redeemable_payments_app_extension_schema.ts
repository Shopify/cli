import {
  BasePaymentsAppExtensionSchema,
  BasePaymentsAppExtensionDeployConfigType,
  BuyerLabelSchema,
} from './base_payments_app_extension_schema.js'
import {zod} from '@shopify/cli-kit/node/schema'

export type RedeemablePaymentsAppExtensionConfigType = zod.infer<typeof RedeemablePaymentsAppExtensionSchema>

export const REDEEMABLE_TARGET = 'payments.redeemable.render'

export const RedeemablePaymentsAppExtensionSchema = BasePaymentsAppExtensionSchema.merge(BuyerLabelSchema).extend({
  targeting: zod.array(zod.object({target: zod.literal(REDEEMABLE_TARGET)})).length(1),
  ui_extension_registration_uuid: zod.string().optional(),
  api_version: zod.string(),
  balance_url: zod.string().url(),
  redeemable_type: zod.literal('gift-card'),
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

export interface RedeemablePaymentsAppExtensionDeployConfigType extends BasePaymentsAppExtensionDeployConfigType {
  ui_extension_registration_uuid?: string

  // BuyerLabelSchema
  default_buyer_label?: string
  buyer_label_to_locale?: {locale: string; label: string}[]

  // Redeemable-specific fields
  balance_url: string
  redeemable_type: 'gift-card'
  ui_extension_handle?: string
  checkout_payment_method_fields?: {
    type: 'string' | 'number' | 'boolean'
    required: boolean
    key: string
  }[]
}

interface CheckoutPaymentMethodField {
  key: string
  type: 'string' | 'number' | 'boolean'
  required: boolean
}
export async function redeemableDeployConfigToCLIConfig(
  config: RedeemablePaymentsAppExtensionDeployConfigType,
): Promise<Omit<RedeemablePaymentsAppExtensionConfigType, 'name' | 'type' | 'metafields' | 'targeting'> | undefined> {
  return {
    api_version: config.api_version,
    payment_session_url: config.start_payment_session_url,
    refund_session_url: config.start_refund_session_url,
    capture_session_url: config.start_capture_session_url,
    void_session_url: config.start_void_session_url,
    ui_extension_registration_uuid: config.ui_extension_registration_uuid,
    merchant_label: config.merchant_label,
    supported_countries: config.supported_countries,
    supported_payment_methods: config.supported_payment_methods,
    test_mode_available: config.test_mode_available,
    buyer_label: config.default_buyer_label,
    buyer_label_translations: config.buyer_label_to_locale,
    redeemable_type: config.redeemable_type,
    balance_url: config.balance_url,
    checkout_payment_method_fields: config.checkout_payment_method_fields?.map((field) => ({
      key: field.key,
      type: field.type,
      required: field.required,
    })),
    ui_extension_handle: config.ui_extension_handle,
  }
}

export async function redeemablePaymentsAppExtensionDeployConfig(
  config: RedeemablePaymentsAppExtensionConfigType,
): Promise<{[key: string]: unknown} | undefined> {
  return {
    api_version: config.api_version,
    start_payment_session_url: config.payment_session_url,
    start_refund_session_url: config.refund_session_url,
    start_capture_session_url: config.capture_session_url,
    start_void_session_url: config.void_session_url,
    ui_extension_registration_uuid: config.ui_extension_registration_uuid,
    merchant_label: config.merchant_label,
    supported_countries: config.supported_countries,
    supported_payment_methods: config.supported_payment_methods,
    test_mode_available: config.test_mode_available,
    default_buyer_label: config.buyer_label,
    buyer_label_to_locale: config.buyer_label_translations,
    redeemable_type: config.redeemable_type,
    balance_url: config.balance_url,
    checkout_payment_method_fields: config.checkout_payment_method_fields,
    ui_extension_handle: config.ui_extension_handle,
  }
}
