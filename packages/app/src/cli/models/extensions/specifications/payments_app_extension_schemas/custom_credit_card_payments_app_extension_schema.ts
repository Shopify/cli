import {
  BasePaymentsAppExtensionSchema,
  BuyerLabelSchema,
  BasePaymentsAppExtensionDeployConfigType,
  ConfirmationSchema,
  SupportedBuyerContextsSchema,
} from './base_payments_app_extension_schema.js'
import {ExtensionRegistration} from '../../../../api/graphql/all_app_extension_registrations.js'
import {extensionUuidToHandle} from '../transform/extension_uuid_to_handle.js'
import {zod} from '@shopify/cli-kit/node/schema'

export type CustomCreditCardPaymentsAppExtensionConfigType = zod.infer<
  typeof CustomCreditCardPaymentsAppExtensionSchema
>

export const CUSTOM_CREDIT_CARD_TARGET = 'payments.custom-credit-card.render'
export const MAX_CHECKOUT_PAYMENT_METHOD_FIELDS = 7

export const CustomCreditCardPaymentsAppExtensionSchema = BasePaymentsAppExtensionSchema.merge(BuyerLabelSchema)
  .merge(ConfirmationSchema)
  .merge(SupportedBuyerContextsSchema)
  .required({
    refund_session_url: true,
    capture_session_url: true,
    void_session_url: true,
  })
  .extend({
    targeting: zod.array(zod.object({target: zod.literal(CUSTOM_CREDIT_CARD_TARGET)})).length(1),
    api_version: zod.string(),
    multiple_capture: zod.boolean(),
    checkout_hosted_fields: zod.array(zod.string()).optional(),
    ui_extension_handle: zod.string().optional(),
    encryption_certificate_fingerprint: zod
      .string()
      .min(1, {message: "Encryption certificate fingerprint can't be blank"}),
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

export interface CustomCreditCardPaymentsAppExtensionDeployConfigType extends BasePaymentsAppExtensionDeployConfigType {
  // BuyerLabelSchema
  default_buyer_label?: string
  buyer_label_to_locale?: {locale: string; label: string}[]

  start_refund_session_url: string
  start_capture_session_url: string
  start_void_session_url: string

  // ConfirmationSchema
  confirmation_callback_url?: string
  supports_3ds: boolean

  multiple_capture: boolean
  checkout_hosted_fields?: string[]
  ui_extension_registration_uuid?: string
  ui_extension_handle?: string
  encryption_certificate: {
    fingerprint: string
    certificate: string
  }
  checkout_payment_method_fields?: {
    type: 'string' | 'number' | 'boolean'
    required: boolean
    key: string
  }[]
}

export function customCreditCardDeployConfigToCLIConfig(
  config: CustomCreditCardPaymentsAppExtensionDeployConfigType,
  allExtensions: ExtensionRegistration[],
): Omit<CustomCreditCardPaymentsAppExtensionConfigType, 'name' | 'type' | 'metafields' | 'targeting'> | undefined {
  const uiExtensionHandle = extensionUuidToHandle(config, allExtensions)

  return {
    api_version: config.api_version,
    payment_session_url: config.start_payment_session_url,
    refund_session_url: config.start_refund_session_url,
    capture_session_url: config.start_capture_session_url,
    void_session_url: config.start_void_session_url,
    confirmation_callback_url: config.confirmation_callback_url,
    merchant_label: config.merchant_label,
    supports_3ds: config.supports_3ds,
    supported_countries: config.supported_countries,
    supported_payment_methods: config.supported_payment_methods,
    supported_buyer_contexts: config.supported_buyer_contexts,
    buyer_label: config.default_buyer_label,
    buyer_label_translations: config.buyer_label_to_locale,
    encryption_certificate_fingerprint: config.encryption_certificate.fingerprint,
    test_mode_available: config.test_mode_available,
    multiple_capture: config.multiple_capture,
    checkout_payment_method_fields: config.checkout_payment_method_fields,
    checkout_hosted_fields: config.checkout_hosted_fields,
    ui_extension_handle: uiExtensionHandle,
  }
}

export async function customCreditCardPaymentsAppExtensionDeployConfig(
  config: CustomCreditCardPaymentsAppExtensionConfigType,
): Promise<{[key: string]: unknown} | undefined> {
  return {
    api_version: config.api_version,
    start_payment_session_url: config.payment_session_url,
    start_refund_session_url: config.refund_session_url,
    start_capture_session_url: config.capture_session_url,
    start_void_session_url: config.void_session_url,
    confirmation_callback_url: config.confirmation_callback_url,
    merchant_label: config.merchant_label,
    supports_3ds: config.supports_3ds,
    supported_countries: config.supported_countries,
    supported_buyer_contexts: config.supported_buyer_contexts,
    default_buyer_label: config.buyer_label,
    buyer_label_to_locale: config.buyer_label_translations,
    encryption_certificate_fingerprint: config.encryption_certificate_fingerprint,
    supported_payment_methods: config.supported_payment_methods,
    test_mode_available: config.test_mode_available,
    multiple_capture: config.multiple_capture,
    checkout_payment_method_fields: config.checkout_payment_method_fields,
    checkout_hosted_fields: config.checkout_hosted_fields,
    ui_extension_handle: config.ui_extension_handle,
  }
}
