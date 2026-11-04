import {
  BasePaymentsAppExtensionSchema,
  BasePaymentsAppExtensionDeployConfigType,
  BuyerLabelSchema,
  ConfirmationSchema,
  DeferredPaymentsSchema,
  MultipleCaptureSchema,
  SupportedBuyerContextsSchema,
} from './base_payments_app_extension_schema.js'
import {validateUrl} from '../../../app/validation/common.js'
import {zod} from '@shopify/cli-kit/node/schema'

export type AcceleratedWalletPaymentsAppExtensionConfigType = zod.infer<
  typeof AcceleratedWalletPaymentsAppExtensionSchema
>

export const ACCELERATED_WALLET_TARGET = 'payments.accelerated-wallet.render'

const HexColorSchema = zod.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex color, like #1A2B3C')

export const AcceleratedWalletPaymentsAppExtensionSchema = BasePaymentsAppExtensionSchema.merge(BuyerLabelSchema)
  .merge(DeferredPaymentsSchema)
  .merge(ConfirmationSchema)
  .merge(MultipleCaptureSchema)
  .merge(SupportedBuyerContextsSchema)
  .extend({
    targeting: zod.array(zod.object({target: zod.literal(ACCELERATED_WALLET_TARGET)})).length(1),
    supports_oversell_protection: zod.boolean().optional(),
    supports_3ds: zod.boolean().optional(),
    wallet_session_create_url: zod.string().url(),
    wallet_session_verify_url: zod.string().url(),
    button_logo_url: validateUrl(zod.string(), {httpsOnly: true, message: 'Must be an HTTPS URL'}),
    button_background_color: HexColorSchema,
    button_foreground_color: HexColorSchema,
  })
  .refine((schema) => !schema.supports_oversell_protection || schema.confirmation_callback_url, {
    message: 'Property required when supports_oversell_protection is true',
    path: ['confirmation_callback_url'],
  })
  .refine((schema) => schema.supports_installments === schema.supports_deferred_payments, {
    message: 'supports_installments and supports_deferred_payments must be the same',
  })

export interface AcceleratedWalletPaymentsAppExtensionDeployConfigType extends BasePaymentsAppExtensionDeployConfigType {
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

  // AcceleratedWallet-specific fields
  wallet_session_create_url: string
  wallet_session_verify_url: string
  button_logo_url: string
  button_background_color: string
  button_foreground_color: string
}

export function acceleratedWalletDeployConfigToCLIConfig(
  config: AcceleratedWalletPaymentsAppExtensionDeployConfigType,
): Omit<AcceleratedWalletPaymentsAppExtensionConfigType, 'name' | 'type' | 'metafields' | 'targeting'> | undefined {
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
    supported_buyer_contexts: config.supported_buyer_contexts,
    test_mode_available: config.test_mode_available,
    buyer_label: config.default_buyer_label,
    buyer_label_translations: config.buyer_label_to_locale,
    supports_oversell_protection: config.supports_oversell_protection,
    supports_3ds: config.supports_3ds,
    supports_deferred_payments: config.supports_deferred_payments,
    supports_installments: config.supports_installments,
    wallet_session_create_url: config.wallet_session_create_url,
    wallet_session_verify_url: config.wallet_session_verify_url,
    button_logo_url: config.button_logo_url,
    button_background_color: config.button_background_color,
    button_foreground_color: config.button_foreground_color,
  }
}

export async function acceleratedWalletPaymentsAppExtensionDeployConfig(
  config: AcceleratedWalletPaymentsAppExtensionConfigType,
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
    supported_buyer_contexts: config.supported_buyer_contexts,
    test_mode_available: config.test_mode_available,
    default_buyer_label: config.buyer_label,
    buyer_label_to_locale: config.buyer_label_translations,
    supports_oversell_protection: config.supports_oversell_protection,
    supports_3ds: config.supports_3ds,
    supports_deferred_payments: config.supports_deferred_payments,
    supports_installments: config.supports_installments,
    wallet_session_create_url: config.wallet_session_create_url,
    wallet_session_verify_url: config.wallet_session_verify_url,
    button_logo_url: config.button_logo_url,
    button_background_color: config.button_background_color,
    button_foreground_color: config.button_foreground_color,
  }
}
