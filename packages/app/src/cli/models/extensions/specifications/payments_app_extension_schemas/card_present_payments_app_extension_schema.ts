import {
  BasePaymentsAppExtensionSchema,
  BasePaymentsAppExtensionDeployConfigType,
} from './base_payments_app_extension_schema.js'
import {zod} from '@shopify/cli-kit/node/schema'

export type CardPresentPaymentsAppExtensionConfigType = zod.infer<typeof CardPresentPaymentsAppExtensionSchema>

export const CARD_PRESENT_TARGET = 'payments.card-present.render'

export const CardPresentPaymentsAppExtensionSchema = BasePaymentsAppExtensionSchema.required({
  refund_session_url: true,
  capture_session_url: true,
  void_session_url: true,
}).extend({
  targeting: zod.array(zod.object({target: zod.literal(CARD_PRESENT_TARGET)})).length(1),
  sync_terminal_transaction_result_url: zod.string().url().optional(),
})

export interface CardPresentPaymentsAppExtensionDeployConfigType extends BasePaymentsAppExtensionDeployConfigType {
  // Following are overwritten as they are required for card present extensions
  start_refund_session_url: string
  start_capture_session_url: string
  start_void_session_url: string

  // CardPresent-specific fields
  sync_terminal_transaction_result_url?: string
}

export function cardPresentDeployConfigToCLIConfig(
  config: CardPresentPaymentsAppExtensionDeployConfigType,
): Omit<CardPresentPaymentsAppExtensionConfigType, 'name' | 'type' | 'metafields' | 'targeting'> | undefined {
  return {
    api_version: config.api_version,
    payment_session_url: config.start_payment_session_url,
    refund_session_url: config.start_refund_session_url,
    capture_session_url: config.start_capture_session_url,
    void_session_url: config.start_void_session_url,
    sync_terminal_transaction_result_url: config.sync_terminal_transaction_result_url,
    merchant_label: config.merchant_label,
    supported_countries: config.supported_countries,
    supported_payment_methods: config.supported_payment_methods,
    test_mode_available: config.test_mode_available,
  }
}

export async function cardPresentPaymentsAppExtensionDeployConfig(
  config: CardPresentPaymentsAppExtensionConfigType,
): Promise<{[key: string]: unknown} | undefined> {
  return {
    api_version: config.api_version,
    start_payment_session_url: config.payment_session_url,
    start_refund_session_url: config.refund_session_url,
    start_capture_session_url: config.capture_session_url,
    start_void_session_url: config.void_session_url,
    sync_terminal_transaction_result_url: config.sync_terminal_transaction_result_url,
    merchant_label: config.merchant_label,
    supported_countries: config.supported_countries,
    supported_payment_methods: config.supported_payment_methods,
    test_mode_available: config.test_mode_available,
  }
}
