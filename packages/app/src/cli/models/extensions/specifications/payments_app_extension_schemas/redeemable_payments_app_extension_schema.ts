import {BaseSchema} from '../../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

export type RedeemablePaymentsAppExtensionConfigType = zod.infer<typeof RedeemablePaymentsAppExtensionSchema>

const MAX_LABEL_SIZE = 50
export const REDEEMABLE_TARGET = 'payments.redeemable.render'
export const RedeemablePaymentsAppExtensionSchema = BaseSchema.extend({
  targeting: zod.array(zod.object({target: zod.literal(REDEEMABLE_TARGET)})).length(1),
  api_version: zod.string(),
  payment_session_url: zod.string().url(),
  refund_session_url: zod.string().url().optional(),
  capture_session_url: zod.string().url().optional(),
  void_session_url: zod.string().url().optional(),
  balance_url: zod.string().url(),
  merchant_label: zod.string().max(MAX_LABEL_SIZE),
  buyer_label: zod.string().max(MAX_LABEL_SIZE).optional(),
  buyer_label_translations: zod.array(zod.object({locale: zod.string(), label: zod.string()})).optional(),
  supported_countries: zod.array(zod.string()),
  supported_payment_methods: zod.array(zod.string()),
  test_mode_available: zod.boolean(),
  redeemable_type: zod.literal('gift_card'),
  checkout_payment_method_fields: zod.array(zod.string()).optional(),
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
