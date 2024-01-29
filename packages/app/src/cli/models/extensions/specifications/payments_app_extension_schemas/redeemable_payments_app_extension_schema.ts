import {BasePaymentsAppExtensionSchema, BuyerLabelSchema} from './base_payments_app_extension_schema.js'
import {zod} from '@shopify/cli-kit/node/schema'

export type RedeemablePaymentsAppExtensionConfigType = zod.infer<typeof RedeemablePaymentsAppExtensionSchema>

export const REDEEMABLE_TARGET = 'payments.redeemable.render'

export const RedeemablePaymentsAppExtensionSchema = BasePaymentsAppExtensionSchema.merge(BuyerLabelSchema).extend({
  targeting: zod.array(zod.object({target: zod.literal(REDEEMABLE_TARGET)})).length(1),
  api_version: zod.string(),
  balance_url: zod.string().url(),
  redeemable_type: zod.literal('gift_card'),
  checkout_payment_method_fields: zod.array(zod.string()).optional(),
})

export async function redeemablePaymentsAppExtensionDeployConfig(
  config: RedeemablePaymentsAppExtensionConfigType,
): Promise<{[key: string]: unknown} | undefined> {
  return {
    target: config.targeting[0]!.target,
    api_version: config.api_version,
    start_payment_session_url: config.payment_session_url,
    start_refund_session_url: config.refund_session_url,
    start_capture_session_url: config.capture_session_url,
    start_void_session_url: config.void_session_url,
    merchant_label: config.merchant_label,
    supported_countries: config.supported_countries,
    supported_payment_methods: config.supported_payment_methods,
    test_mode_available: config.test_mode_available,
    default_buyer_label: config.buyer_label,
    buyer_label_to_locale: config.buyer_label_translations,
    redeemable_type: config.redeemable_type,
    balance_url: config.balance_url,
    checkout_payment_method_fields: config.checkout_payment_method_fields,
  }
}
